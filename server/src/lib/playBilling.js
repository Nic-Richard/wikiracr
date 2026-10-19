function createPlayBilling({ store, deletions, clerk, api, sendAlert = () => {}, liveApproved = () => process.env.PLAY_LIVE_APPROVED === 'true', now = Date.now }) {
  const syncing = new Map();
  async function sync(userId, token) {
    if (typeof token !== 'string' || token.length < 10 || token.length > 4096) throw new Error('Invalid purchase token');
    const remote = await api.get(token);
    const account = remote.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (!account || account !== store.accountId(userId)) throw new Error('Purchase belongs to another account');
    const lines = remote.lineItems || [];
    if (lines.length !== 1 || lines[0].productId !== api.PRODUCT || lines[0].offerDetails?.basePlanId !== 'monthly') throw new Error('Unexpected Google Play product');
    const line = lines[0], expiresAt = Date.parse(line.expiryTime);
    const state = remote.subscriptionState;
    if (deletions.get(userId)) {
      if (line.autoRenewingPlan?.autoRenewEnabled) await api.cancel(token);
      if (remote.latestOrderId) deletions.addReferences(userId, [remote.latestOrderId]);
      return { state: 'deleting', active: false };
    }
    if (state === 'SUBSCRIPTION_STATE_PENDING') return { state: 'pending', active: false };
    if (state === 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED') return { state, active: false };
    if (!Number.isFinite(expiresAt)) throw new Error('Google Play purchase has no expiry');
    if (!remote.testPurchase && !liveApproved()) throw new Error('Live Google Play purchases are not enabled');
    const before = store.status(userId);
    store.save(userId, token, state, expiresAt, remote.latestOrderId);
    const user = await clerk.users.getUser(userId);
    if (deletions.get(userId)) {
      if (line.autoRenewingPlan?.autoRenewEnabled) await api.cancel(token);
      return { state: 'deleting', active: false };
    }
    const active = store.active(userId, now());
    const metadata = user.publicMetadata || {};
    await clerk.users.updateUserMetadata(userId, { publicMetadata: { playPro: active,
      isPro: active || !!metadata.stripeSubscriptionId,
    } });
    if (active && remote.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') await api.acknowledge(token);
    if (before?.state !== state || before?.expires_at !== expiresAt) sendAlert('billing', {
      title: active ? (before ? 'Google Play Pro renewed or updated' : 'Google Play Pro started') : 'Google Play Pro ended',
      fields: [{ name: 'User', value: userId }, { name: 'Order', value: remote.latestOrderId || 'Pending' }, { name: 'State', value: state }],
    });
    return { state, active, expiresAt };
  }
  async function verify(userId, token) {
    const previous = syncing.get(userId) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => sync(userId, token));
    syncing.set(userId, next);
    try { return await next; } finally { if (syncing.get(userId) === next) syncing.delete(userId); }
  }
  return {
    verify,
    status: async userId => {
      if (!api.configured()) return { available: false };
      const accountId = store.register(userId);
      const user = await clerk.users.getUser(userId);
      return { available: true, productId: api.PRODUCT, accountId, active: store.active(userId, now()),
        otherSubscription: !!user.publicMetadata?.stripeSubscriptionId, subscription: store.status(userId) };
    },
    notify: async data => {
      if (data.packageName !== api.PACKAGE) throw new Error('Wrong Play package');
      if (data.testNotification) return;
      const token = data.subscriptionNotification?.purchaseToken || data.voidedPurchaseNotification?.purchaseToken;
      if (!token) return;
      let owner = store.ownerForToken(token);
      if (!owner) {
        const remote = await api.get(token), account = remote.externalAccountIdentifiers?.obfuscatedExternalAccountId;
        owner = account && (store.ownerForAccount(account) || deletions.forReference(account)?.user_id);
      }
      if (owner) await verify(owner, token);
    },
    cancelAccount: async userId => {
      if (syncing.has(userId)) await syncing.get(userId).catch(() => {});
      for (const { token, state, expiresAt } of store.owned(userId)) {
        if (state === 'SUBSCRIPTION_STATE_EXPIRED') continue;
        let remote;
        try { remote = await api.get(token); }
        catch (error) { if ([404, 410].includes(error.response?.status) && expiresAt < now()) continue; throw error; }
        if (remote.lineItems?.some(line => line.autoRenewingPlan?.autoRenewEnabled)) await api.cancel(token);
      }
    },
    refresh: async userId => { for (const { token } of store.owned(userId)) await verify(userId, token); },
  };
}
module.exports = { createPlayBilling };
