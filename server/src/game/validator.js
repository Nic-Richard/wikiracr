const axios = require('axios');
const log = require('../lib/logger');

const linkCache = new Map();
const CACHE_MAX = 5000;

function normalise(title) {
  return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase();
}

function cacheLinks(key, links) {
  if (linkCache.size >= CACHE_MAX) {
    linkCache.delete(linkCache.keys().next().value);
  }
  linkCache.set(key, links);
}

async function fetchLinksPage(title, plcontinue) {
  const params = {
    action:  'query',
    prop:    'links',
    titles:  title,
    redirects: 1,
    pllimit: 500,
    plnamespace: 0,
    format:  'json',
    origin:  '*',
    ...(plcontinue ? { plcontinue } : {}),
  };
  const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
    params,
    timeout: 8000,
    headers: { 'User-Agent': 'WikiRacr/1.0 (https://wikiracr.com; support@wikiracr.com)' },
  });
  return data;
}

// Finish caching the article's link set after an early match.
async function fetchRemainingPages(title, key, startContinue, linksSoFar) {
  const links = new Set(linksSoFar);
  let plcontinue = startContinue;
  try {
    while (plcontinue) {
      const data = await fetchLinksPage(title, plcontinue);
      const pages = data.query?.pages || {};
      for (const page of Object.values(pages)) {
        for (const link of (page.links || [])) links.add(normalise(link.title));
      }
      plcontinue = data.continue?.plcontinue || null;
    }
    cacheLinks(key, links);
  } catch (err) {
    log.debug('[wiki] background link fetch failed:', err.message);
  }
}

async function isValidLink(fromTitle, toTitle) {
  const key    = normalise(fromTitle);
  const target = normalise(toTitle);

  if (linkCache.has(key)) return linkCache.get(key).has(target);

  const links = new Set();
  let plcontinue = null;

  try {
    do {
      const data = await fetchLinksPage(fromTitle, plcontinue);
      const pages = data.query?.pages || {};
      for (const page of Object.values(pages)) {
        for (const link of (page.links || [])) links.add(normalise(link.title));
      }
      plcontinue = data.continue?.plcontinue || null;

      if (links.has(target)) {
        if (plcontinue) fetchRemainingPages(fromTitle, key, plcontinue, links);
        else cacheLinks(key, links);
        return true;
      }
    } while (plcontinue);

  } catch (err) {
    log.debug('[wiki] validation API unavailable:', err.message);
    return true;
  }

  cacheLinks(key, links);
  return false;
}

module.exports = { isValidLink };
