const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const { createArticlePolicy, allowedPair } = require('../src/lib/articlePolicy');
const { createReportModeration } = require('../src/lib/reportModeration');
const { parseAction } = require('../src/lib/moderationAuth');

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = { exec: sql => sqlite.exec(sql), prepare: sql => sqlite.prepare(sql), transaction: fn => () => { sqlite.exec('BEGIN'); try { const result = fn(); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } };
  db.exec('PRAGMA foreign_keys = ON; CREATE TABLE reports (id INTEGER PRIMARY KEY, type TEXT, message TEXT, context TEXT, user_id TEXT, created_at INTEGER)');
  db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?)').run(1, 'article', 'Explicit content', JSON.stringify({ articleTitle: 'Example article' }), 'account-123456', 123);
  const policy = createArticlePolicy(db);const execute = createReportModeration(db, policy);
  const data = { action: 'inspect', requestId: crypto.randomUUID(), target: { kind: 'report', id: '1' }, actor: { id: '123', name: 'Mod', permissions: (1n << 40n).toString() } };
  return { sqlite, db, policy, execute, data };
}

test('global blacklist decisions have a durable, bound receipt and exclude affected pairs', t => {
  const { db, policy, execute, data } = fixture(t);const state = execute(data);
  const decision = { ...data, action: 'blacklist', expectedVersion: state.version };
  const result = execute(decision);assert.equal(result.status, 'blocked');
  assert.equal(policy.blocked('Example_article'), true);
  assert.equal(allowedPair({ start_title: 'Start', end_title: 'End', optimal_path: '["Start","Example article","End"]' }, policy), null);
  const restarted = createReportModeration(db, createArticlePolicy(db));
  assert.deepEqual(restarted(decision), result);
  assert.equal(db.prepare('SELECT count(*) AS n FROM moderation_actions').get().n, 1);
  assert.throws(() => execute({ ...decision, action: 'dismiss' }), /another action/);
  assert.equal(result.actor.id, '123');
});

test('stale, malformed and unsupported report decisions change nothing', t => {
  const { db, execute, data } = fixture(t);
  assert.throws(() => execute({ ...data, action: 'blacklist', expectedVersion: 'stale' }), /changed/);
  assert.throws(() => execute({ ...data, target: { kind: 'report', id: '../../other' } }), /Invalid/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM blocked_articles').get().n, 0);
  const state = execute(data);
  const result = execute({ ...data, action: 'dismiss', expectedVersion: state.version });
  assert.equal(result.status, 'dismissed');
  assert.throws(() => execute({ ...data, requestId: crypto.randomUUID(), action: 'blacklist', expectedVersion: state.version }), /changed/);
});

test('callbacks require fresh per-app signatures and a Discord moderator identity', () => {
  const secret = 's'.repeat(40);const timestamp = String(Math.floor(Date.now() / 1000));
  const data = { action: 'resolve', target: { kind: 'report', id: '1' }, expectedVersion: 'open', requestId: crypto.randomUUID(), actor: { id: '123', name: 'Mod', permissions: (1n << 40n).toString() } };
  const sign = value => { const raw = Buffer.from(JSON.stringify(value)); return { raw, headers: { 'x-action-timestamp': timestamp, 'x-action-signature': crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex') } }; };
  const signed = sign(data);assert.equal(parseAction(signed.raw, signed.headers, secret).actor.id, '123');
  assert.throws(() => parseAction(signed.raw, signed.headers, 'x'.repeat(40)), /signature/);
  assert.throws(() => parseAction(signed.raw, signed.headers, secret, Date.now() + 3600000), /signature/);
  const denied = sign({ ...data, actor: { ...data.actor, permissions: '0' } });
  assert.throws(() => parseAction(denied.raw, denied.headers, secret), /permission/);
  assert.throws(() => parseAction(signed.raw, signed.headers, ''), /configured/);
});

test('article unblocking and report reopening preserve receipts and reject decisions from earlier cycles', t => {
  const { execute, data, policy } = fixture(t);
  const initial = execute(data);
  const block = { ...data, action: 'blacklist', expectedVersion: initial.version };
  const blocked = execute(block);
  const unblock = { ...data, requestId: crypto.randomUUID(), action: 'unblock', expectedVersion: blocked.version };
  const unblocked = execute(unblock);
  assert.equal(policy.blocked('Example article'), false);
  assert.deepEqual(execute(block), blocked);
  assert.equal(policy.blocked('Example article'), false, 'retrying an old block only returns its receipt');
  assert.deepEqual(execute(unblock), unblocked);
  const reopened = execute({ ...data, requestId: crypto.randomUUID(), action: 'reopen', expectedVersion: unblocked.version });
  assert.equal(reopened.status, 'open');
  assert.notEqual(reopened.version, initial.version);
  assert.throws(() => execute({ ...block, requestId: crypto.randomUUID() }), /changed/);
  const again = execute({ ...block, requestId: crypto.randomUUID(), expectedVersion: reopened.version });
  assert.equal(again.status, 'blocked');
  assert.equal(policy.blocked('Example article'), true);
});
