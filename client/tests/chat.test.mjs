import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('chat requires sign-in and rules acceptance, persists blocks and reports with retry', async () => {
  const cache = mkdtempSync(join(tmpdir(), 'wikiracr-chat-test-'));
  const server = await createServer({
    configFile: false, cacheDir: cache, root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'chat-test', enforce: 'pre',
      transform(source, id) {
        if (id.endsWith('/src/components/ChatPanel.jsx')) return source.replace("import { useUser, SignInButton } from '../lib/auth';", "const useUser = () => ({user: window.signedOut ? null : {id: 'viewer'}}); const SignInButton = ({children}) => children;");
      },
      configureServer(server) {
        server.middlewares.use('/chat-test', async (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml('/chat-test', `<div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import ChatPanel from '/src/components/ChatPanel.jsx';
import '/src/index.css';
const root = createRoot(document.getElementById('root'));
window.messages = [{id:'message1',userId:'alice',socketId:'old',username:'Alice',text:'Hello there'}];
window.reports = []; window.sent = []; window.failReport = true;
window.draw = () => root.render(React.createElement(ChatPanel,{messages:[...window.messages],mySocketId:'me',onSend:async(text,termsVersion)=>{if(text==='Banned')throw new Error('Chat is turned off for your account.');window.sent.push({text,termsVersion});},onReport:async(id,reason)=>{if(window.failReport)throw new Error('Try again');window.reports.push({id,reason});}}));
window.draw();</script>`));
        });
      },
    }, react()],
  });
  let browser;
  try {
    await server.listen();
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'),
      headless: true, args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.setViewport({ width: 390, height: 844 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.httpServer.address().port}/chat-test`;
    const click = async text => {
      try {
        await page.waitForFunction(text => [...document.querySelectorAll('button')].some(button => button.textContent === text || (text === 'Chat' && button.firstChild?.textContent.trim() === text)), {}, text);
      } catch { throw new Error(`Missing button ${text}: ${errors.join('; ')}; ${await page.evaluate(() => document.body.textContent)}`); }
      await page.evaluate(text => [...document.querySelectorAll('button')].find(button => button.textContent === text || (text === 'Chat' && button.firstChild?.textContent.trim() === text)).click(), text);
    };
    await page.goto(url);
    await click('Chat');
    assert.equal(await page.$('input[placeholder="Message..."]'), null);
    assert.equal(await page.$eval('button[type="submit"]', button => button.disabled), true);
    assert.ok(await page.$('a[href="https://wikiracr.com/terms"]'));
    await page.click('input[type="checkbox"]');
    await click('Enable chat');
    await page.waitForSelector('input[placeholder="Message..."]');
    await page.type('input[placeholder="Message..."]', 'Hello');
    await click('Send');
    assert.deepEqual(await page.evaluate(() => window.sent), [{text:'Hello',termsVersion:'2026-10-20'}]);
    await page.type('input[placeholder="Message..."]', 'Banned');
    await click('Send');
    await page.waitForFunction(() => document.body.textContent.includes('Chat is turned off'));
    assert.equal(await page.$eval('input[placeholder="Message..."]', input => input.value), 'Banned');
    await click('Block');
    await page.waitForFunction(() => !document.body.textContent.includes('Hello there'));
    await page.reload();
    await click('Chat');
    await page.evaluate(() => { window.messages.push({id:'message2',userId:'alice',socketId:'reconnected',username:'Alice',text:'Still blocked'}); window.draw(); });
    await page.waitForFunction(() => document.body.textContent.includes('No messages to show'));
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Still blocked')), false);
    await click('Blocked (1)');
    await click('Unblock');
    await click('Blocked (0)');
    await page.waitForFunction(() => document.body.textContent.includes('Still blocked'));
    await click('Report');
    assert.equal(await page.evaluate(() => document.body.textContent.includes('private staff channel on Discord')), true);
    await click('Send report');
    await page.waitForFunction(() => document.body.textContent.includes('Try again'));
    await page.evaluate(() => { window.failReport = false; });
    await click('Send report');
    await page.waitForFunction(() => document.body.textContent.includes('Report sent for review'));
    assert.deepEqual(await page.evaluate(() => window.reports), [{ id: 'message1', reason: 'Harassment' }]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { window.signedOut = true; window.draw(); });
    await click('Chat');
    await page.waitForFunction(() => document.body.textContent.includes('Sign in to chat'));
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Still blocked')), false);
    assert.equal(await page.$('input[placeholder="Message..."]'), null);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); assert.ok(cache.startsWith(join(tmpdir(), 'wikiracr-chat-test-'))); rmSync(cache, { recursive: true, force: true }); }
});
