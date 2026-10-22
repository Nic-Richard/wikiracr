import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from '../client/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'www');
const server = createServer(async (request, response) => {
  const name = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!name.startsWith(root + sep) && name !== root) { response.writeHead(403).end(); return; }
  const type = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' };
  try { response.setHeader('Content-Type', type[extname(name)] || 'application/octet-stream'); response.end(await readFile(name)); }
  catch { response.setHeader('Content-Type', 'text/html'); response.end(await readFile(resolve(root, 'index.html'))); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const requests = [], errors = [];
let proActivated = false;
const goal = 'Charles III of the United Kingdom and the other Commonwealth realms';
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--safe-top', '24px');
      document.documentElement.style.setProperty('--safe-bottom', '24px');
    });
    window.androidBridge = {};
    window.__nativeEvents = {};
    let user = null, next = 0;
    const methods = ['initialize', 'getToken', 'signIn', 'signOut', 'removeListener', 'minimizeApp', 'open', 'start', 'stop', 'product', 'purchase', 'restore'];
    window.__grantPro = () => { user = { ...user, publicMetadata: { isPro: true } }; };
    window.Capacitor = {
      PluginHeaders: ['WikiRacrAuth', 'WikiRacrMotion', 'WikiRacrBilling', 'App', 'Browser'].map(name => ({ name, methods: [...methods.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }] })),
      nativeCallback: (plugin, method, options, callback) => { window.__nativeEvents[`${plugin}:${options.eventName}`] = callback; return String(++next); },
      nativePromise: async (plugin, method) => {
        if (plugin === 'WikiRacrBilling') {
          if (method === 'product') return { available: true, price: 'US$5.99', period: 'P1M' };
          if (method === 'purchase' || method === 'restore') return { purchases: [{ purchaseToken: 'fixture-purchase-token-123456', pending: false }] };
          return {};
        }
        if (method === 'signIn') user = { id: 'fixture-user', username: 'Racer', publicMetadata: {}, primaryEmailAddress: { emailAddress: 'racer@example.invalid' } };
        if (method === 'signOut') user = null;
        if (method === 'getToken') return { token: user ? 'fixture-token' : null };
        if (['initialize', 'signIn', 'signOut'].includes(method)) return { user };
        return {};
      },
    };
  });
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const respond = body => request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify(body) });
    if (url.origin === origin || url.protocol === 'blob:' || url.protocol === 'data:') return request.continue();
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return request.continue();
    if (url.hostname === 'wikiracr.com' && url.pathname.startsWith('/api/')) {
      requests.push({ path: url.pathname, method: request.method(), token: request.headers().authorization });
      if (request.method() === 'OPTIONS') return respond({});
      if (url.pathname === '/api/articles/check') return respond({ allowed: true, title: url.searchParams.get('title') });
      if (url.pathname === '/api/pair') return respond({ pair: { id: 1, startTitle: 'Alpha', endTitle: goal, pathLength: 2, optimalPath: ['Alpha', 'Bravo', goal] } });
      if (url.pathname === '/api/report') return respond({ ok: true });
      if (url.pathname.startsWith('/api/leaderboard/')) return respond([]);
      if (url.pathname === '/api/account-deletion') return respond({ state: 'none' });
      if (url.pathname === '/api/me/profile') return respond({ stats: {}, speedrunBests: [] });
      if (url.pathname === '/api/me/history') return respond({ history: [] });
      if (url.pathname === '/api/play/status') return respond({ available: true, accountId: 'a'.repeat(64), active: proActivated });
      if (url.pathname === '/api/play/verify') { proActivated = true; await page.evaluate(() => window.__grantPro()); return respond({ active: true }); }
      throw new Error(`Unexpected API call: ${request.method()} ${url.pathname}`);
    }
    if (url.hostname === 'en.wikipedia.org') {
      if (url.pathname.includes('/page/html/')) {
        const title = decodeURIComponent(url.pathname.split('/').pop());
        const next = title === 'Alpha' ? 'Bravo' : goal;
        return request.respond({ status: 200, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: `<h1>${title}</h1><p>Find the next article.</p><a href="./${next}">${next}</a><script>parent.__articleScriptRan=true</script><img src="bad" onerror="parent.__articleScriptRan=true">` });
      }
      if (url.pathname.includes('/page/summary/')) return respond({ extract: 'The destination article.', title: 'Charlie' });
      return request.respond({ status: 200, contentType: 'text/css', body: '' });
    }
    return request.abort();
  });
  await page.goto(origin);
  await page.waitForSelector('[data-menu-panel="main"]');
  assert.equal(await page.$('.native-tabs'), null);
  await page.waitForFunction(() => !!window.__nativeEvents['WikiRacrMotion:tilt']);
  await page.evaluate(() => window.__nativeEvents['WikiRacrMotion:tilt']({ x: 0.4, y: 0.2 }));
  assert.equal(await page.$eval('[data-native-menu] [class*="content"]', element => element.style.transform), '', 'Tilt must not move tappable controls');
  assert(await page.$eval('canvas', element => element.width <= innerWidth + 64), 'Background must not render a desktop-sized canvas');
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientX: 5, clientY: 5 })));
  assert.equal(await page.$eval('[data-native-menu] [class*="content"]', element => element.style.transform), '', 'Touch dragging must not tilt the menu');
  await page.$eval('a[href="/upgrade"]', element => element.scrollIntoView({ block: 'center' }));
  await page.click('a[href="/upgrade"]');
  await page.waitForFunction(() => location.pathname === '/upgrade');
  await page.goto(origin);
  await page.waitForSelector('[data-menu-panel="main"]');
  await page.click('button[title="Disable motion effects"]');
  assert.equal(await page.$eval('[data-native-menu] [class*="content"]', element => element.style.transform), '');
  await page.click('button[title="Enable motion effects"]');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home must fit the viewport');
  assert(await page.$eval('[data-native-menu]', element => element.scrollHeight <= element.clientHeight + 1), 'Play must not scroll the document');
  if (process.env.SMOKE_SCREENSHOT) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: process.env.SMOKE_SCREENSHOT }); }
  await page.$$eval('button', buttons => buttons.find(button => button.textContent === 'PLAY SOLO').click());
  await page.waitForSelector('[data-menu-panel="solo"]');
  await page.$$eval('button', buttons => buttons.find(button => button.textContent.startsWith('START ')).click());
  await page.waitForSelector('iframe', { timeout: 16000 });
  assert.equal(await page.$$eval('button[aria-label="Report a problem"]', buttons => buttons.length), 0, 'Report lives in settings on phones');
  await page.click('[data-native-hud] button[aria-label="Settings"]');
  assert.equal(await page.$eval('button[aria-label="Reset article zoom"]', element => element.textContent), '100%', 'First article must start at readable zoom');
  assert.equal(await page.$$eval('button[aria-label="Report a problem"]', buttons => buttons.length), 1);
  assert.equal(await page.evaluate(() => document.body.textContent.includes('Report article')), false);
  await page.click('button[aria-label="Report a problem"]');
  await page.waitForSelector('dialog[open]');
  await page.$$eval('dialog button', buttons => buttons.find(button => button.textContent === 'Article').click());
  assert(await page.$eval('dialog', element => element.textContent.includes('Article: Alpha')), 'Existing report panel must identify the current article');
  await page.click('button[aria-label="Close report"]');
  await page.click('button[aria-label="Close settings"]');
  const frameElement = await page.$('iframe'), frame = await frameElement.contentFrame();
  await frame.waitForSelector('a');
  assert.equal(await page.evaluate(() => window.__articleScriptRan), undefined, 'Wikipedia cannot execute scripts in the app');
  assert.equal(await frame.evaluate(() => { try { return !!parent.Capacitor; } catch { return false; } }), false, 'Article must not access the native bridge');
  assert.equal(await page.$eval('iframe', element => element.getAttribute('sandbox')), 'allow-scripts');
  const geometry = await page.$eval('iframe', element => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width }));
  if (process.env.SMOKE_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_SCREENSHOT });
  assert(geometry.height > 350 && geometry.width <= 390, `Article should occupy most of the phone: ${JSON.stringify(geometry)}`);
  assert(await page.$eval('[data-native-hud]', element => element.getBoundingClientRect().height <= 125), 'Solo header must stay two rows');
  assert(await page.$eval('[data-native-hud]', element => element.textContent.includes('GOAL')), 'Goal must be labelled');
  const fits = () => page.$eval('[data-native-hud]', element => [...element.querySelectorAll('button, [class*="goalTitle"]')].every(child => { const box = child.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; }));
  assert(await fits(), 'Game controls must stay inside the viewport');
  for (const viewport of [{ width: 320, height: 740 }, { width: 844, height: 390 }]) {
    await page.setViewport({ ...viewport, isMobile: true, hasTouch: true });
    assert(await fits(), 'Game controls must fit small and rotated screens');
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluate(() => window.__nativeEvents['App:backButton']({ canGoBack: true }));
  await page.waitForSelector('[role="alertdialog"]');
  await page.click('[role="alertdialog"] button');
  await frame.click('a');
  await page.waitForFunction(() => document.querySelector('iframe')?.title === 'Bravo');
  const nextFrame = await (await page.$('iframe')).contentFrame();
  await nextFrame.waitForSelector('a');
  await nextFrame.click('a');
  await page.waitForFunction(() => document.body.innerText.includes('YOUR PATH'), { timeout: 15000 });
  assert(!requests.some(request => request.method === 'POST'), 'Guest fixture race must not write account data');
  await page.goto(origin);
  await page.waitForSelector('button[aria-label="Report a problem"]');
  await page.click('button[aria-label="Report a problem"]');
  await page.waitForSelector('dialog[open]');
  await page.setViewport({ width: 390, height: 420, isMobile: true, hasTouch: true });
  assert(await page.$eval('dialog', element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 24 && box.bottom <= innerHeight - 23; }), 'Report fits above a keyboard-sized viewport');
  await page.type('dialog textarea', 'Fixture report only');
  await page.click('dialog button[class*="submit"]');
  await page.waitForFunction(() => document.querySelector('dialog')?.innerText.includes('Thanks, got it.'));
  assert(requests.some(request => request.path === '/api/report' && request.method === 'POST'));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(origin + '/upgrade');
  await page.waitForSelector('button[class*="upgradeBtn"]');
  assert(!(await page.evaluate(() => document.body.innerText)).includes('$'), 'Native account screen must not expose checkout');
  await page.click('button[class*="upgradeBtn"]');
  await page.waitForFunction(() => document.querySelector('button[class*="upgradeBtn"]')?.textContent.includes('US$5.99'));
  await page.click('button[class*="upgradeBtn"]');
  await page.waitForFunction(() => document.body.innerText.includes('OPEN PRO FEATURES'));
  assert(requests.some(request => request.path === '/api/play/verify' && request.token === 'Bearer fixture-token'));
  await page.$$eval('button', buttons => buttons.find(button => button.textContent === 'Restore purchases').click());
  await page.waitForFunction(() => !document.querySelector('button[class*="playAction"]')?.disabled);
  await page.click('a[href="/menu"]');
  await page.waitForSelector('[data-menu-panel="main"]');
  await page.$eval('a[href="/pro"]', element => element.scrollIntoView({ block: 'center' }));
  await page.click('a[href="/pro"]');
  await page.waitForFunction(() => location.pathname === '/pro');
  await page.goBack();
  await page.waitForSelector('[data-menu-panel="main"]');
  const profileRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/me/profile' && request.headers().authorization === 'Bearer fixture-token');
  await page.click('a[href="/account"]');
  await page.waitForFunction(() => document.body.innerText.includes('Racer'));
  await profileRequest;
  assert(requests.some(request => request.path === '/api/me/profile' && request.token === 'Bearer fixture-token'));
  assert(!requests.some(request => request.path.includes('/stripe/')));
  await page.setViewport({ width: 320, height: 740, isMobile: true, hasTouch: true });
  await page.goto(origin);
  await page.waitForSelector('[data-menu-panel="main"]');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Small-phone home must fit');
  await page.$eval('a[href="/upgrade"]', element => element.scrollIntoView({ block: 'center' }));
  await page.click('a[href="/upgrade"]');
  await page.waitForFunction(() => location.pathname === '/upgrade');
  for (const route of ['/privacy', '/terms', '/how-to-play']) {
    await page.goto(origin + route);
    await page.waitForSelector('[data-route-scroll]');
    const bounds = await page.$eval('[data-route-scroll]', element => {
      element.scrollTop = element.scrollHeight;
      return { top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, viewport: innerHeight, remaining: element.scrollHeight - element.clientHeight - element.scrollTop, width: element.scrollWidth, available: element.clientWidth };
    });
    assert(bounds.top >= 24 && bounds.bottom <= bounds.viewport - 23 && bounds.remaining <= 1 && bounds.width <= bounds.available + 1, `${route}: ${JSON.stringify(bounds)}`);
  }
  assert.deepEqual(errors, []);
  console.log('Native fixtures pass: home, full article race, iframe isolation, Android back, account token, billing restrictions and small-screen layout.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
