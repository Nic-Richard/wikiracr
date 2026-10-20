const axios = require('axios');
const { articleKey } = require('./articlePolicy');
const resolved = new Map();

async function resolveTitle(title) {
  if (typeof title !== 'string' || !title.trim() || title.length > 300) throw new Error('Invalid article title');
  const key = articleKey(title), cached = resolved.get(key);
  if (cached && cached.until > Date.now()) return cached.title;
  const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
    params: { action: 'query', titles: title.replaceAll('_', ' '), redirects: 1, format: 'json' },
    timeout: 8000, headers: { 'User-Agent': 'WikiRacr/1.0 (https://wikiracr.com; support@wikiracr.com)' },
  });
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing !== undefined || page.ns !== 0) throw new Error('Article not available');
  if (resolved.size >= 5000) resolved.delete(resolved.keys().next().value);
  resolved.set(key, { title: page.title, until: Date.now() + 5 * 60_000 });
  return page.title;
}

async function articleAccess(title) {
  if (typeof title !== 'string' || !title.trim() || title.length > 300) throw new Error('Invalid article title');
  const policy = require('../db').getArticlePolicy?.();
  if (policy?.blocked(title)) return { allowed: false, title };
  if (!policy?.size()) return { allowed: true, title };
  const canonical = await resolveTitle(title);
  return { allowed: !policy.blocked(canonical), title: canonical };
}

module.exports = { articleAccess, resolveTitle };
