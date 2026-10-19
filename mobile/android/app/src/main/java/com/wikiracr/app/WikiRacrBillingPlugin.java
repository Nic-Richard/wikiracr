package com.wikiracr.app;

import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "WikiRacrBilling")
public class WikiRacrBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String PRODUCT = "wikiracr_pro";
    private BillingClient client;
    private ProductDetails product;
    private String offerToken;
    private PluginCall purchaseCall;
    private boolean connecting;
    private final List<Waiting> waiting = new ArrayList<>();
    private record Waiting(PluginCall call, Runnable action) {}

    @Override public void load() {
        client = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }

    private void withClient(PluginCall call, Runnable action) {
        getBridge().executeOnMainThread(() -> {
            if (client.isReady()) { action.run(); return; }
            waiting.add(new Waiting(call, action));
            if (connecting) return;
            connecting = true;
            client.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    connecting = false;
                    List<Waiting> ready = new ArrayList<>(waiting);
                    waiting.clear();
                    for (Waiting item : ready) {
                        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) item.action.run();
                        else item.call.reject("Google Play is unavailable. Install the app through its testing track and try again.");
                    }
                }
                @Override public void onBillingServiceDisconnected() { connecting = false; }
            });
        });
    }

    @PluginMethod public void product(PluginCall call) {
        withClient(call, () -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(List.of(
                QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.SUBS).build())).build();
            client.queryProductDetailsAsync(params, (result, details) -> {
                product = null; offerToken = null;
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Could not load the Google Play price."); return; }
                for (ProductDetails item : details.getProductDetailsList()) {
                    if (!PRODUCT.equals(item.getProductId()) || item.getSubscriptionOfferDetails() == null) continue;
                    for (ProductDetails.SubscriptionOfferDetails offer : item.getSubscriptionOfferDetails()) {
                        if (!"monthly".equals(offer.getBasePlanId()) || offer.getOfferId() != null) continue;
                        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                        if (phases.isEmpty()) continue;
                        ProductDetails.PricingPhase phase = phases.get(phases.size() - 1);
                        product = item; offerToken = offer.getOfferToken();
                        call.resolve(new JSObject().put("available", true).put("price", phase.getFormattedPrice()).put("period", phase.getBillingPeriod()));
                        return;
                    }
                }
                call.resolve(new JSObject().put("available", false));
            });
        });
    }

    @PluginMethod public void purchase(PluginCall call) {
        String account = call.getString("accountId");
        if (account == null || !account.matches("[a-f0-9]{64}")) { call.reject("Sign in before subscribing."); return; }
        withClient(call, () -> {
            if (purchaseCall != null) { call.reject("A purchase is already open."); return; }
            if (product == null || offerToken == null) { call.reject("Load the Google Play price before subscribing."); return; }
            BillingFlowParams params = BillingFlowParams.newBuilder().setObfuscatedAccountId(account)
                .setProductDetailsParamsList(List.of(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offerToken).build())).build();
            purchaseCall = call;
            BillingResult result = client.launchBillingFlow(getActivity(), params);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { purchaseCall = null; call.reject("Google Play could not open checkout."); }
        });
    }

    private JSObject purchases(List<Purchase> purchases) {
        JSArray list = new JSArray();
        if (purchases != null) for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PRODUCT)) continue;
            list.put(new JSObject().put("purchaseToken", purchase.getPurchaseToken())
                .put("pending", purchase.getPurchaseState() == Purchase.PurchaseState.PENDING));
        }
        return new JSObject().put("purchases", list);
    }

    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = purchaseCall;
        purchaseCall = null;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            JSObject data = purchases(purchases);
            if (call != null) call.resolve(data);
            else notifyListeners("purchasesUpdated", data);
        } else if (call != null) {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) call.reject("Purchase cancelled", "PURCHASE_CANCELLED");
            else call.reject("Your purchase did not complete. Restore it if you were charged.");
        }
    }

    @PluginMethod public void restore(PluginCall call) {
        withClient(call, () -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (result, purchases) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) call.reject("Could not restore Google Play purchases.");
            else call.resolve(purchases(purchases));
        }));
    }

    @Override protected void handleOnDestroy() {
        if (purchaseCall != null) purchaseCall.reject("Checkout was interrupted. Restore purchases when you reopen the app.");
        for (Waiting item : waiting) item.call.reject("Billing was closed.");
        waiting.clear();
        client.endConnection();
    }
}
