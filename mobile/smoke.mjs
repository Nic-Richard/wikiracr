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
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    window.androidBridge = {};
    window.__nativeEvents = {};
    let user = null, next = 0;
    const methods = ['initialize', 'getToken', 'signIn', 'signOut', 'removeListener', 'minimizeApp', 'open'];
    window.Capacitor = {
      PluginHeaders: ['WikiRacrAuth', 'App', 'Browser'].map(name => ({ name, methods: [...methods.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }] })),
      nativeCallback: (plugin, method, options, callback) => { window.__nativeEvents[`${plugin}:${options.eventName}`] = callback; return String(++next); },
      nativePromise: async (plugin, method) => {
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
    if (url.hostname === 'wikiracr.com' && url.pathname.startsWith('/api/')) {
      requests.push({ path: url.pathname, method: request.method(), token: request.headers().authorization });
      if (request.method() === 'OPTIONS') return respond({});
      if (url.pathname === '/api/pair') return respond({ pair: { id: 1, startTitle: 'Alpha', endTitle: 'Charlie', pathLength: 2, optimalPath: ['Alpha', 'Bravo', 'Charlie'] } });
      if (url.pathname.startsWith('/api/leaderboard/')) return respond([]);
      if (url.pathname === '/api/account-deletion') return respond({ state: 'none' });
      if (url.pathname === '/api/me/profile') return respond({ stats: {}, speedrunBests: [] });
      if (url.pathname === '/api/me/history') return respond({ history: [] });
      throw new Error(`Unexpected API call: ${request.method()} ${url.pathname}`);
    }
    if (url.hostname === 'en.wikipedia.org') {
      if (url.pathname.includes('/page/html/')) {
        const title = decodeURIComponent(url.pathname.split('/').pop());
        const next = title === 'Alpha' ? 'Bravo' : 'Charlie';
        return request.respond({ status: 200, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: `<h1>${title}</h1><p>Find the next article.</p><a href="./${next}">${next}</a><script>parent.__articleScriptRan=true</script><img src="bad" onerror="parent.__articleScriptRan=true">` });
      }
      if (url.pathname.includes('/page/summary/')) return respond({ extract: 'The destination article.', title: 'Charlie' });
      return request.respond({ status: 200, contentType: 'text/css', body: '' });
    }
    return request.abort();
  });
  await page.goto(origin);
  await page.waitForSelector('a[href="/game?d=easy"]');
  assert.equal(await page.$$eval('.native-tabs a', links => links.length), 4);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home must fit the viewport');
  await page.click('a[href="/game?d=easy"]');
  await page.waitForSelector('iframe', { timeout: 16000 });
  const frameElement = await page.$('iframe'), frame = await frameElement.contentFrame();
  await frame.waitForSelector('a');
  assert.equal(await page.evaluate(() => window.__articleScriptRan), undefined, 'Wikipedia cannot execute scripts in the app');
  assert.equal(await frame.evaluate(() => { try { return !!parent.Capacitor; } catch { return false; } }), false, 'Article must not access the native bridge');
  assert.equal(await page.$eval('iframe', element => element.getAttribute('sandbox')), 'allow-scripts');
  const geometry = await page.$eval('iframe', element => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width }));
  assert(geometry.height > 350 && geometry.width <= 390, 'Article should occupy most of the phone');
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
  await page.goto(origin + '/upgrade');
  await page.waitForSelector('.native-info');
  assert(!(await page.evaluate(() => document.body.innerText)).includes('$'), 'Native account screen must not expose checkout');
  await page.click('.native-info button');
  const profileRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/me/profile' && request.headers().authorization === 'Bearer fixture-token');
  await page.click('.native-tabs a[href="/account"]');
  await page.waitForFunction(() => document.body.innerText.includes('Racer'));
  await profileRequest;
  assert(requests.some(request => request.path === '/api/me/profile' && request.token === 'Bearer fixture-token'));
  assert(!requests.some(request => request.path.includes('/stripe/')));
  await page.setViewport({ width: 320, height: 740, isMobile: true, hasTouch: true });
  await page.click('.native-tabs a[href="/"]');
  await page.waitForSelector('a[href="/game?d=easy"]');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Small-phone home must fit');
  assert.deepEqual(errors, []);
  console.log('Native fixtures pass: home, full article race, iframe isolation, Android back, account token, billing restrictions and small-screen layout.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
