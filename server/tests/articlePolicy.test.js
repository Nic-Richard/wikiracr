const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { createArticlePolicy, articleKey, allowedPair } = require('../src/lib/articlePolicy');

test('moderation persists blocks, normalizes titles and records report decisions', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE reports(id INTEGER PRIMARY KEY, type TEXT, message TEXT, context TEXT, user_id TEXT, created_at INTEGER); INSERT INTO reports VALUES(1,\'article\',\'Reason\',\'{}\',NULL,1)');
    const policy = createArticlePolicy(db);
    policy.block('Test Article', 'Reviewed report');
    assert.equal(policy.blocked('test_article'), true);
    assert.equal(policy.blocked('Test%20Article'), true);
    assert.equal(createArticlePolicy(db).blocked('Test Article'), true);
    const pair = { start_title: 'Alpha', end_title: 'Charlie', optimal_path: '["Alpha","Test Article","Charlie"]' };
    assert.equal(allowedPair(pair, policy), null);
    assert.equal(policy.pending().length, 1);
    policy.review(1, 'blocked', 'Article reviewed and blocked');
    assert.equal(policy.pending().length, 0);
    assert.throws(() => policy.review(99, 'blocked', 'Missing'), /not found/);
    policy.unblock('test_article');
    assert.equal(createArticlePolicy(db).blocked('Test Article'), false);
    assert.deepEqual(allowedPair(pair, policy), pair);
    assert.equal(articleKey(' TEST__Article '), 'test article');
  } finally { db.close(); }
});
