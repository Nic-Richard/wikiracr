const assert = require('node:assert/strict');
const { test } = require('node:test');
const { allowedOrigins } = require('../src/lib/allowedOrigins');

test('web and packaged Android origins stay explicit', () => {
  const origins = allowedOrigins('https://www.wikiracr.com');
  assert.deepEqual(origins, ['https://wikiracr.com', 'https://www.wikiracr.com', 'https://localhost']);
  for (const origin of ['http://localhost', 'null', 'https://evil.example', 'https://wikiracr.com.evil.example']) assert(!origins.includes(origin));
  assert(allowedOrigins('http://localhost:5173').includes('http://localhost:5173'));
});
