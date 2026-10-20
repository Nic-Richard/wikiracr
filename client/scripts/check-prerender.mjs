import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(dist, '.' + pathname);
  if (file !== dist && !file.startsWith(dist + sep)) { response.writeHead(404).end(); return; }
  let body, chosen;
  for (const candidate of [file, resolve(file, 'index.html')]) {
    try { body = await readFile(candidate); chosen = candidate; break; } catch {}
  }
  if (!body) {
    body = await readFile(resolve(dist, pathname.startsWith('/room/') ? 'spa.html' : '404.html'));
    chosen = 'index.html';
    response.statusCode = pathname.startsWith('/room/') ? 200 : 404;
  }
  response.setHeader('Content-Type', ({ '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' })[extname(chosen)] || 'text/html');
  response.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'),
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (/hydration|hydrating|did not match|Minified React error/i.test(message.text())) failures.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!request.url().startsWith(origin + '/') || !['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) request.abort();
    else request.continue();
  });

  await page.setJavaScriptEnabled(false);
  for (const pathname of ['/', '/wiki-race', '/how-to-play', '/privacy', '/terms']) {
    const response = await page.goto(origin + pathname, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    assert.ok(await page.$('h1'));
    assert.equal(await page.$eval('link[rel="canonical"]', node => node.href), 'https://wikiracr.com' + pathname);
  }
  await page.click('a[href="/privacy"]');
  assert.equal(new URL(page.url()).pathname, '/privacy');
  const missing = await page.goto(origin + '/does-not-exist', { waitUntil: 'domcontentloaded' });
  assert.equal(missing.status(), 404);
  assert.match(await page.$eval('h1', node => node.textContent), /Page not found/);
  console.log('Public content, links, metadata and the 404 page work without JavaScript.');

  await page.setJavaScriptEnabled(true);
  await page.evaluateOnNewDocument(() => localStorage.setItem('wikiracr-motion', 'false'));
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 850 });
    for (const pathname of ['/', '/wiki-race', '/privacy', '/terms', '/does-not-exist']) {
      await page.goto(origin + pathname, { waitUntil: 'networkidle0' });
      assert.ok(await page.$('h1'));
      await page.waitForFunction(() => document.querySelector('button[title="Enable motion effects"]'));
    }
    await page.evaluate(() => localStorage.setItem('wikiracr-motion', 'false'));
    await page.goto(origin + '/how-to-play', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelector('button[title="Enable motion effects"]'));
    if (width > 700) {
      await page.click('button[title="Enable motion effects"]');
      await page.waitForFunction(() => document.querySelector('button[title="Disable motion effects"]'));
    }
    await page.evaluate(() => { window.__prerenderNavigation = true; });
    await page.click('a[href="/wiki-race"]');
    await page.waitForFunction(() => location.pathname === '/wiki-race' && document.title.startsWith('Wiki Racing Online'));
    assert.ok(await page.$('h1'));
    assert.equal(await page.evaluate(() => window.__prerenderNavigation), true);
    console.log(`Hydration, saved motion preference and navigation pass at ${width}px.`);
  }
  assert.deepEqual(failures, []);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
