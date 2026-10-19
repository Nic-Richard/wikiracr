const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Webhook } = require('svix');
const { deletedUserEvent } = require('../src/lib/clerkWebhook');
const secret = 'whsec_' + Buffer.from('disposable-webhook-test-secret-32').toString('base64');

test('identity deletion requires an authentic, current raw-body signature', async () => {
  const raw = JSON.stringify({ type: 'user.deleted', data: { id: 'user_disposable', deleted: true } });
  function headers(time = new Date()) {
    return { 'svix-id': 'msg_disposable', 'svix-timestamp': String(Math.floor(+time / 1000)),
      'svix-signature': new Webhook(secret).sign('msg_disposable', time, raw) };
  }
  assert.equal(await deletedUserEvent(raw, headers(), secret), 'user_disposable');
  await assert.rejects(deletedUserEvent(raw + ' ', headers(), secret));
  await assert.rejects(deletedUserEvent(raw, headers(new Date(Date.now() - 600_000)), secret));
  await assert.rejects(deletedUserEvent(raw, {}, secret));
  await assert.rejects(deletedUserEvent(raw, headers(), ''));
});
