import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('article reports preserve context without hiding content', async () => {
  const reports = [];
  const cache = mkdtempSync(join(tmpdir(), 'wikiracr-article-test-'));
  const server = await createServer({ configFile: false, cacheDir: cache, root: fileURLToPath(new URL('..', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'article-test', enforce: 'pre',
    transform(source, id) {
      if (id.endsWith('/src/components/ReportButton.jsx')) return source.replace("import { useAuth } from '../lib/auth';", 'const useAuth = () => ({isSignedIn: false});');
    },
    configureServer(server) {
      server.middlewares.use('/api/report', (req, res) => {
        let body = ''; req.on('data', chunk => { body += chunk; });
        req.on('end', () => { reports.push(JSON.parse(body)); res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
      });
      server.middlewares.use('/article-test', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml('/article-test', `<div id="root" style="height:90vh"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import WikiArticle from '/src/components/WikiArticle.jsx';import ReportButton from '/src/components/ReportButton.jsx';import '/src/index.css';
const root=createRoot(document.getElementById('root'));window.draw=(title='Alpha')=>root.render(React.createElement(React.Fragment,null,React.createElement(ReportButton,{context:{page:'game',pairId:7,currentArticle:title,startTitle:'Alpha',endTitle:'Charlie'}}),React.createElement(WikiArticle,{title,goalTitle:'Charlie',onLinkClick:()=>{}})));window.draw();</script>`));
      });
    },
  }, react()] });
  let browser;
  try {
    await server.listen();
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.setViewport({ width: 390, height: 844 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname === 'en.wikipedia.org') {
        if (url.pathname.includes('/page/html/')) {
          return request.respond({ status: 200, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: '<h1>Fixture article</h1><p>Article content</p>' });
        }
        return request.respond({ status: 200, contentType: 'text/css', body: '' });
      }
      if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['blob:', 'data:'].includes(url.protocol)) return request.continue();
      return request.abort();
    });
    const url = `http://127.0.0.1:${server.httpServer.address().port}/article-test`;
    const click = async label => {
      await page.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent === label), {}, label);
      await page.evaluate(label => [...document.querySelectorAll('button')].find(button => button.textContent === label).click(), label);
    };
    await page.goto(url);
    await page.waitForSelector('iframe');
    assert.equal(await page.$$eval('button[aria-label="Report a problem"]', buttons => buttons.length), 1);
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Report article')), false);
    await page.click('button[aria-label="Report a problem"]');
    await page.waitForSelector('textarea');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].filter(button => ['Article', 'Bad pair', 'Bug', 'Other'].includes(button.textContent)).length), 4);
    assert.match(await page.$eval('textarea', element => element.placeholder), /pair/);
    await click('Article');
    await page.evaluate(() => window.draw('Bravo'));
    await page.waitForFunction(() => document.querySelector('iframe')?.title === 'Bravo');
    assert.ok(await page.evaluate(() => document.body.textContent.includes('Article: Alpha')));
    await page.type('textarea', 'Unsuitable article');
    await click('SEND REPORT');
    await page.waitForFunction(() => document.body.textContent.includes('Thanks, got it.'));
    assert.equal(reports[0].type, 'article');
    assert.equal(reports[0].context.articleTitle, 'Alpha');
    assert.equal(reports[0].context.currentArticle, 'Alpha');
    assert.equal(reports[0].context.pairId, 7);
    assert.ok(await page.$('iframe'));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Hide article')), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('wikiracr-hidden-articles')), null);
    await page.reload();
    await page.evaluate(() => window.draw(''));
    await page.click('button[aria-label="Report a problem"]');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Article')), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); assert.ok(cache.startsWith(join(tmpdir(), 'wikiracr-article-test-'))); rmSync(cache, { recursive: true, force: true }); }
});
