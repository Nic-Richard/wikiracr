const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { createDeletionStore } = require('../src/lib/accountDeletionStore');
const { createAccountDeletion } = require('../src/lib/accountDeletion');

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const store = createDeletionStore(db);
  const calls = [];
  const clerk = { users: {
    getUser: async id => ({ id, emailAddresses: [{ emailAddress: `${id}@example.com` }], publicMetadata: { stripeCustomerId: 'cus_owned', stripeSubscriptionId: 'sub_owned' } }),
    deleteUser: async id => calls.push(['identity', id]),
  } };
  const stripe = {
    checkout: { sessions: {
      list: async function* () { yield { id: 'cs_own', metadata: { clerkUserId: 'user_own' } }; yield { id: 'cs_other', metadata: { clerkUserId: 'user_other' } }; },
      expire: async id => calls.push(['checkout', id]),
    } },
    subscriptions: {
      list: async function* () {
        yield { id: 'sub_owned', status: 'active' };
        yield { id: 'sub_metadata', status: 'trialing', metadata: { clerkUserId: 'user_own' } };
        yield { id: 'sub_other', status: 'active', metadata: { clerkUserId: 'user_other' } };
        yield { id: 'sub_old', status: 'canceled', metadata: { clerkUserId: 'user_own' } };
      },
      cancel: async id => calls.push(['subscription', id]),
    },
  };
  const options = { store, clerk, stripe, eraseAlerts: async () => ({ complete: true, cursor: {} }),
    deleteData: id => calls.push(['data', id]), disconnect: id => calls.push(['disconnect', id]) };
  return { db, store, calls, options, service: createAccountDeletion(options) };
}

test('deletion requires confirmation, records only the authenticated account and is idempotent', async t => {
  const f = fixture(t);
  assert.equal((await f.service.request('user_own', 'no')).status, 400);
  assert.equal(f.store.get('user_own'), undefined);
  const first = await f.service.request('user_own', 'DELETE');
  assert.equal(first.status, 202);
  assert.equal(first.body.state, 'pending');
  assert(f.store.get('user_own').references.includes('cus_owned'));
  assert(!('references' in first.body));
  await f.service.request('user_own', 'DELETE');
  assert.equal(f.calls.length, 1);
  assert.equal(f.store.get('user_other'), undefined);
  assert.equal(f.store.due().length, 0);
});

test('cleanup cancels only owned billing and retains resumable alert progress before deleting data', async t => {
  const f = fixture(t);
  await f.service.request('user_own', 'DELETE');
  let attempts = 0;
  const service = createAccountDeletion({ ...f.options, eraseAlerts: async (_refs, cursor) => {
    if (++attempts === 1) return { complete: false, cursor: { 123: '456' } };
    assert.deepEqual(cursor, { 123: '456' });
    return { complete: true, cursor: { 123: 'done' } };
  } });
  await service.process(f.store.get('user_own'));
  assert(!f.calls.some(call => call[0] === 'data'));
  assert.deepEqual(f.store.get('user_own').cursor, { 123: '456' });
  await service.process(f.store.get('user_own'));
  assert.equal(f.store.get('user_own').state, 'complete');
  assert(f.calls.some(call => call[0] === 'checkout' && call[1] === 'cs_own'));
  assert(f.calls.some(call => call[0] === 'subscription' && call[1] === 'sub_owned'));
  assert(!f.calls.some(call => /other|old/.test(call[1])));
  assert.deepEqual(f.calls.slice(-2), [['data', 'user_own'], ['identity', 'user_own']]);
});

test('provider failures keep the job retryable and an already removed identity completes safely', async t => {
  const f = fixture(t);
  await f.service.request('user_own', 'DELETE');
  const failed = createAccountDeletion({ ...f.options, eraseAlerts: async () => { throw new Error('offline'); } });
  await assert.rejects(failed.process(f.store.get('user_own')), /offline/);
  assert(!f.calls.some(call => call[0] === 'data'));
  assert.equal(f.store.get('user_own').state, 'pending');
  f.options.clerk.users.deleteUser = async () => { throw { status: 404 }; };
  await f.service.process(f.store.get('user_own'));
  assert.equal(f.store.get('user_own').state, 'complete');
});

test('cleanup waits for in-flight requests and expires completed receipts after 30 days', async t => {
  const f = fixture(t);
  await f.service.request('user_own', 'DELETE');
  const waiting = createAccountDeletion({ ...f.options, drain: () => false });
  await waiting.process(f.store.get('user_own'));
  assert.equal(f.calls.length, 1);
  await f.service.process(f.store.get('user_own'));
  assert.equal(f.store.forReference('cus_owned').user_id, 'user_own');
  f.store.expire(Date.now() + 31 * 86400000);
  assert.equal(f.store.get('user_own'), undefined);
});

test('direct Clerk deletion queues local and billing cleanup without needing the removed identity', async t => {
  const f = fixture(t);
  f.options.clerk.users.getUser = async () => { throw new Error('Identity already removed'); };
  assert.equal(f.service.requestDeletedIdentity('user_own').state, 'pending');
  await f.service.process(f.store.get('user_own'));
  assert.equal(f.store.get('user_own').state, 'complete');
  assert(f.store.get('user_own').references.includes('sub_metadata'));
  assert(f.calls.some(call => call[0] === 'data' && call[1] === 'user_own'));
});

test('late payment references survive an older worker snapshot and restart alert cleanup', async t => {
  const f = fixture(t);
  await f.service.request('user_own', 'DELETE');
  let scans = 0;
  const service = createAccountDeletion({ ...f.options, eraseAlerts: async () => {
    if (++scans === 1) f.store.addReferences('user_own', ['cus_late', 'sub_late']);
    return { complete: true, cursor: { 123: 'done' } };
  } });
  await service.process(f.store.get('user_own'));
  const pending = f.store.get('user_own');
  assert.equal(pending.state, 'pending');
  assert.equal(Boolean(pending.alerts_erased), false);
  assert.equal(pending.completed_at, null);
  assert.deepEqual(pending.cursor, {});
  assert(pending.references.includes('cus_late'));
  assert(!f.calls.some(call => call[0] === 'identity'));
  await service.process(pending);
  assert.equal(f.store.get('user_own').state, 'complete');
  f.store.addReferences('user_own', ['cus_after_completion']);
  assert.equal(f.store.get('user_own').state, 'pending');
  assert.equal(f.store.get('user_own').completed_at, null);
});
