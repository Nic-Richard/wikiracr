import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from '../client/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const adb = process.env.ADB_PATH || 'C:/Users/Nic/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
assert(serial.startsWith('emulator-'), 'This script drives only an Android emulator.');
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const pid = run('shell', 'pidof', 'com.wikiracr.app').trim();
assert(/^\d+$/.test(pid), 'Start WikiRacr in the emulator first.');
run('forward', 'tcp:9225', `localabstract:webview_devtools_remote_${pid}`);
for (let attempt = 0; ; attempt++) {
  try { const response = await fetch('http://127.0.0.1:9225/json/version'); if (response.ok) break; } catch {}
  if (attempt >= 20) throw new Error('Emulator WebView debugger did not start.');
  await delay(500);
}
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9225', defaultViewport: null });
try {
  const page = (await browser.pages()).find(page => page.url().startsWith('https://localhost'));
  assert(page, 'Packaged app WebView not found.');
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === 'localhost' || ['blob:', 'data:'].includes(url.protocol)) return request.continue();
    if (url.hostname === 'wikiracr.com' && url.pathname === '/api/pair') return request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ pair: { id: 1, startTitle: 'Alpha', endTitle: 'Charlie', pathLength: 2, optimalPath: ['Alpha', 'Bravo', 'Charlie'] } }) });
    if (url.hostname === 'en.wikipedia.org' && url.pathname.includes('/page/html/')) {
      const title = decodeURIComponent(url.pathname.split('/').pop()), next = title === 'Alpha' ? 'Bravo' : 'Charlie';
      return request.respond({ status: 200, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: `<h1>${title}</h1><p>Find your next article through the links below.</p><a href="./${next}">${next}</a>` });
    }
    if (url.hostname === 'en.wikipedia.org' && url.pathname.includes('/page/summary/')) return request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ extract: 'The goal article.' }) });
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return request.continue();
    if (url.hostname === 'en.wikipedia.org') return request.respond({ status: 200, contentType: 'text/css', body: '' });
    return request.abort();
  });
  await page.goto('https://localhost/');
  await page.waitForSelector('[data-menu-panel="main"]');
  await page.$$eval('button', buttons => buttons.find(button => button.textContent === 'PLAY SOLO').click());
  await page.waitForSelector('[data-menu-panel="solo"]');
  await page.$$eval('button', buttons => buttons.find(button => button.textContent.startsWith('START ')).click());
  await page.waitForSelector('iframe', { timeout: 16000 });
  let frame = await (await page.$('iframe')).contentFrame();
  await frame.waitForSelector('a');
  const geometry = await page.$eval('iframe', element => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width, viewport: innerWidth }));
  assert(geometry.height > 350 && geometry.width <= geometry.viewport + 1, JSON.stringify(geometry));
  run('shell', 'input', 'keyevent', '4');
  await page.waitForSelector('[role="alertdialog"]');
  await page.click('[role="alertdialog"] button');
  await frame.click('a');
  await page.waitForFunction(() => document.querySelector('iframe')?.title === 'Bravo');
  run('shell', 'input', 'keyevent', '3');
  run('shell', 'am', 'start', '-n', 'com.wikiracr.app/.MainActivity');
  await page.waitForFunction(() => document.querySelector('iframe')?.title === 'Bravo');
  frame = await (await page.$('iframe')).contentFrame();
  await frame.waitForSelector('a');
  await frame.click('a');
  await page.waitForFunction(() => document.body.innerText.includes('YOUR PATH'), { timeout: 15000 });
  run('shell', 'input', 'keyevent', '4');
  await page.waitForSelector('[data-menu-panel="main"]');
  console.log('Android 15 passes: packaged launch, article race, hardware back confirmation, background/resume and result return. Requests stay on fixtures.');
} finally { browser.disconnect(); }
