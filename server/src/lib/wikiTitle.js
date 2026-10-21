const axios = require('axios');

async function resolveTitle(title) {
  if (typeof title !== 'string' || !title.trim() || title.length > 300) throw new Error('Invalid article title');
  const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
    params: { action: 'query', titles: title.replaceAll('_', ' '), redirects: 1, format: 'json' },
    timeout: 8000, headers: { 'User-Agent': 'WikiRacr/1.0 (https://wikiracr.com; support@wikiracr.com)' },
  });
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing !== undefined || page.ns !== 0) throw new Error('Article not available');
  return page.title;
}

module.exports = { resolveTitle };
