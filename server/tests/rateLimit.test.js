const test = require('node:test');
const assert = require('node:assert/strict');
const { rateLimit } = require('../src/lib/rateLimit');

test('allows the limit per key, then refuses with 429', () => {
  const limit = rateLimit({ limit: 2, windowMs: 60000, key: (req) => req.ip, message: 'slow down' });
  const run = (ip) => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    let passed = false;
    limit({ ip }, res, () => { passed = true; });
    return passed ? 'ok' : res.code;
  };
  assert.deepEqual([run('a'), run('a'), run('a'), run('b')], ['ok', 'ok', 429, 'ok']);
});
