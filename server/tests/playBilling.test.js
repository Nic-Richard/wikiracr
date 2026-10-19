const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { createPlayStore } = require('../src/lib/playStore');
const { createDeletionStore } = require('../src/lib/accountDeletionStore');
const { createPlayBilling } = require('../src/lib/playBilling');
const { createAccountDeletion } = require('../src/lib/accountDeletion');

const TOKEN = 'fixture-purchase-token-123456';
const NOW = Date.parse('2026-10-19T12:00:00Z');
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const store = createPlayStore(db, () => 'a'.repeat(64)), deletions = createDeletionStore(db);
  const users = { user_a: { publicMetadata: {} }, user_b: { publicMetadata: {} } };
  const calls = [], alerts = [];
  const state = { remote: {
    externalAccountIdentifiers: { obfuscatedExternalAccountId: store.register('user_a') },
    lineItems: [{ productId: 'wikiracr_pro', offerDetails: { basePlanId: 'monthly' }, expiryTime: new Date(NOW + 86400000).toISOString(), autoRenewingPlan: { autoRenewEnabled: true } }],
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', latestOrderId: 'GPA.fixture.1', testPurchase: {},
  } };
  const clerk = { users: {
    getUser: async id => ({ id, emailAddresses: [], ...users[id] }),
    updateUserMetadata: async (id, data) => { users[id] = { publicMetadata: { ...users[id].publicMetadata, ...data.publicMetadata } }; },
    deleteUser: async id => calls.push(['delete', id]),
  } };
  const api = { PRODUCT: 'wikiracr_pro', PACKAGE: 'com.wikiracr.app', configured: () => true,
    get: async () => structuredClone(state.remote),
    acknowledge: async token => { calls.push(['ack', token]); state.remote.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; },
    cancel: async token => calls.push(['cancel', token]),
  };
  const service = createPlayBilling({ store, deletions, clerk, api, now: () => NOW, sendAlert: (...args) => alerts.push(args), liveApproved: () => false });
  return { db, store, deletions, users, calls, alerts, state, clerk, api, service };
}

test('Play verifies ownership, persists encrypted receipts and acknowledges once benefits exist', async t => {
  const f = fixture(t);
  const result = await f.service.verify('user_a', TOKEN);
  assert.equal(result.active, true);
  assert.equal(f.users.user_a.publicMetadata.isPro, true);
  assert.deepEqual(f.calls, [['ack', TOKEN]]);
  assert.equal(f.db.prepare('SELECT token_cipher FROM play_subscriptions').get().token_cipher.includes(TOKEN), false);
  assert.equal(f.store.owned('user_a')[0].token, TOKEN);
  await f.service.verify('user_a', TOKEN);
  assert.equal(f.calls.length, 1);
  assert.equal(f.alerts.length, 1);
  await assert.rejects(f.service.verify('user_b', TOKEN), /another account/);
});

test('Play rejects wrong products, plans, accounts and unapproved real payments', async t => {
  for (const mutate of [remote => { remote.lineItems[0].productId = 'other'; }, remote => { remote.lineItems[0].offerDetails.basePlanId = 'other'; }, remote => { remote.externalAccountIdentifiers.obfuscatedExternalAccountId = 'wrong'; }, remote => { delete remote.testPurchase; }]) {
    const f = fixture(t); mutate(f.state.remote);
    await assert.rejects(f.service.verify('user_a', TOKEN));
    assert.equal(f.store.active('user_a', NOW), false);
    assert.equal(f.calls.length, 0);
  }
});

test('Pending and cancelled pending purchases grant and acknowledge nothing', async t => {
  const f = fixture(t);
  for (const state of ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED']) {
    f.state.remote.subscriptionState = state;
    delete f.state.remote.lineItems[0].expiryTime;
    assert.equal((await f.service.verify('user_a', TOKEN)).active, false);
    assert.equal(f.store.status('user_a'), null);
    assert.deepEqual(f.calls, []);
  }
});

test('Cancelled and grace-period subscriptions retain paid time; expired receipts do not', async t => {
  const f = fixture(t);
  for (const state of ['SUBSCRIPTION_STATE_CANCELED', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']) {
    f.state.remote.subscriptionState = state;
    assert.equal((await f.service.verify('user_a', TOKEN)).active, true);
  }
  f.state.remote.subscriptionState = 'SUBSCRIPTION_STATE_EXPIRED';
  f.state.remote.lineItems[0].expiryTime = new Date(NOW - 1000).toISOString();
  assert.equal((await f.service.verify('user_a', TOKEN)).active, false);
  assert.equal(f.users.user_a.publicMetadata.isPro, false);
});

test('Play expiration preserves an existing Stripe subscription', async t => {
  const f = fixture(t);
  f.users.user_a.publicMetadata.stripeSubscriptionId = 'sub_existing';
  f.state.remote.subscriptionState = 'SUBSCRIPTION_STATE_EXPIRED';
  f.state.remote.lineItems[0].expiryTime = new Date(NOW - 1000).toISOString();
  await f.service.verify('user_a', TOKEN);
  assert.equal(f.users.user_a.publicMetadata.isPro, true);
});

test('Known receipts cannot be transferred even if Google binding later changes', async t => {
  const f = fixture(t);
  await f.service.verify('user_a', TOKEN);
  f.state.remote.externalAccountIdentifiers.obfuscatedExternalAccountId = f.store.register('user_b');
  await assert.rejects(f.service.verify('user_b', TOKEN), /another account/);
  assert.equal(f.store.ownerForToken(TOKEN), 'user_a');
});

test('Notifications recover missed client confirmation and always read current Google state', async t => {
  const f = fixture(t);
  const notification = { packageName: f.api.PACKAGE, subscriptionNotification: { purchaseToken: TOKEN, notificationType: 2 } };
  await f.service.notify(notification);
  assert.equal(f.store.active('user_a', NOW), true);
  f.state.remote.subscriptionState = 'SUBSCRIPTION_STATE_ON_HOLD';
  await f.service.notify(notification);
  assert.equal(f.store.active('user_a', NOW), false);
  await assert.rejects(f.service.notify({ ...notification, packageName: 'wrong' }));
});

test('Late Play purchases after account deletion are cancelled without recreating data', async t => {
  const f = fixture(t);
  const account = f.store.accountId('user_a');
  f.deletions.request('user_a', ['user_a', account]);
  f.store.erase('user_a');
  await f.service.notify({ packageName: f.api.PACKAGE, subscriptionNotification: { purchaseToken: TOKEN } });
  assert.deepEqual(f.calls, [['cancel', TOKEN]]);
  assert.equal(f.store.status('user_a'), null);
  assert.equal(f.users.user_a.publicMetadata.isPro, undefined);
});

test('Account deletion cancels Play before erasing data and retries on cancellation failure', async t => {
  const f = fixture(t);
  await f.service.verify('user_a', TOKEN);
  const options = { store: f.deletions, clerk: f.clerk,
    stripe: { checkout: { sessions: { list: async function* () {} } }, subscriptions: { list: async function* () {} } },
    playReferences: id => f.store.references(id), cancelPlay: id => f.service.cancelAccount(id),
    eraseAlerts: async () => ({ complete: true, cursor: {} }), deleteData: id => { f.calls.push(['erase', id]); f.store.erase(id); } };
  const deletion = createAccountDeletion(options);
  await deletion.request('user_a', 'DELETE');
  f.api.cancel = async () => { throw new Error('Temporary Google failure'); };
  await assert.rejects(deletion.process(f.deletions.get('user_a')));
  assert.equal(f.store.owned('user_a').length, 1);
  f.api.cancel = async token => f.calls.push(['cancel', token]);
  await deletion.process(f.deletions.get('user_a'));
  assert(f.calls.findIndex(call => call[0] === 'cancel') < f.calls.findIndex(call => call[0] === 'erase'));
  assert.equal(f.store.owned('user_a').length, 0);
  assert(f.deletions.get('user_a').references.includes(f.store.accountId('user_a')));
});

test('Push authentication requires a verified email and exact configured audience/identity', async t => {
  const { OAuth2Client } = require('google-auth-library');
  const api = require('../src/lib/playApi');
  process.env.PLAY_RTDN_AUDIENCE = 'https://example.invalid/api/play/notify';
  process.env.PLAY_RTDN_EMAIL = 'push@example.invalid';
  t.after(() => { delete process.env.PLAY_RTDN_AUDIENCE; delete process.env.PLAY_RTDN_EMAIL; });
  let payload = { email: process.env.PLAY_RTDN_EMAIL, email_verified: true };
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async options => {
    assert.equal(options.audience, process.env.PLAY_RTDN_AUDIENCE);
    return { getPayload: () => payload };
  });
  await api.verifyPush('Bearer fixture');
  await assert.rejects(api.verifyPush(''));
  payload = { email: 'wrong@example.invalid', email_verified: true };
  await assert.rejects(api.verifyPush('Bearer fixture'));
  payload = { email: process.env.PLAY_RTDN_EMAIL, email_verified: 'false' };
  await assert.rejects(api.verifyPush('Bearer fixture'));
});
