import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { appFetch, NATIVE_APP, NativeBilling, NativeBrowser } from './platform';

export function usePlayBilling() {
  const { isSignedIn, getToken, refresh } = useAuth();
  const [status, setStatus] = useState(null), [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [notice, setNotice] = useState(null);
  const verifying = useRef(false);
  const request = useCallback(async (path, body) => {
    const token = await getToken();
    const response = await appFetch('/api/play/' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Google Play is not available yet.');
    return data;
  }, [getToken]);
  const load = useCallback(async () => {
    if (!NATIVE_APP || !isSignedIn) return;
    const data = await request('status');
    setStatus(data);
    if (data.available) {
      const product = await NativeBilling.product();
      setPrice(product.available ? product.price : null);
    }
    return data;
  }, [isSignedIn, request]);
  useEffect(() => {
    if (!NATIVE_APP) return;
    let stopped = false;
    setError(null); setStatus(null); setPrice(null);
    load().catch(() => { if (!stopped) setError('Google Play subscriptions are not available yet.'); });
    return () => { stopped = true; };
  }, [load]);
  const settle = useCallback(async result => {
    let active = false;
    for (const purchase of result.purchases || []) {
      if (purchase.pending) { setNotice('Payment is pending. Pro will unlock after Google Play confirms it.'); continue; }
      const verified = await request('verify', { purchaseToken: purchase.purchaseToken });
      active ||= verified.active;
    }
    if (active) { setNotice('Pro is active on your account.'); await refresh(); }
    await load();
    return active;
  }, [request, refresh, load]);
  useEffect(() => {
    if (!NATIVE_APP || !isSignedIn) return;
    let stopped = false, handle;
    NativeBilling.addListener('purchasesUpdated', async data => {
      if (verifying.current) return;
      verifying.current = true;
      try { await settle(data); } catch { setError('A purchase needs restoring. Please try Restore purchases.'); }
      finally { verifying.current = false; }
    }).then(listener => { if (stopped) listener.remove(); else handle = listener; }).catch(() => {});
    return () => { stopped = true; handle?.remove(); };
  }, [isSignedIn, settle]);
  const act = async restore => {
    if (busy || !status?.available) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = restore ? await NativeBilling.restore() : await NativeBilling.purchase({ accountId: status.accountId });
      const active = await settle(result);
      if (restore && !active && !result.purchases?.length) setNotice('No Google Play subscription was found for this Play account.');
    } catch (error) { if (error.code !== 'PURCHASE_CANCELLED') setError(error.message || 'Google Play could not complete this request.'); }
    finally { setBusy(false); }
  };
  return { status, price, busy, error, notice, subscribe: () => act(false), restore: () => act(true),
    manage: () => NativeBrowser.open({ url: 'https://play.google.com/store/account/subscriptions?sku=wikiracr_pro&package=com.wikiracr.app' }) };
}
