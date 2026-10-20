import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getRouteMetadata, KNOWN_PATHS } from '../src/lib/routeMetadata.js';

const output = pathname => new URL(pathname === '/' ? '../dist/index.html' : `../dist${pathname}/index.html`, import.meta.url);

test('public pages contain their content and route metadata before JavaScript', () => {
  for (const pathname of ['/', '/wiki-race', '/how-to-play', '/privacy', '/terms']) {
    const html = readFileSync(output(pathname), 'utf8');
    const meta = getRouteMetadata(pathname);
    assert.ok(html.includes(`<title>${meta.title}</title>`), pathname);
    assert.ok(html.includes(`rel="canonical" href="${meta.canonical}"`), pathname);
    assert.match(html, /id="root" data-prerendered="true"><div>/);
    assert.match(html, /<h1\b/);
    assert.match(html, /href="\/(?:menu|how-to-play|wiki-race|privacy|terms)"/);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.ok(JSON.parse(json)['@type'], pathname);
    }
  }
});

test('all known routes retain HTML entry points; private sessions stay client-rendered and noindex', () => {
  for (const pathname of KNOWN_PATHS) assert.ok(existsSync(output(pathname)), pathname);
  for (const pathname of ['/game', '/account', '/profile', '/custom-lobby', '/pro', '/upgrade/success']) {
    const html = readFileSync(output(pathname), 'utf8');
    assert.match(html, /name="robots" content="noindex, follow"/);
    assert.match(html, /<div id="root"><\/div>/);
    assert.doesNotMatch(html, /data-prerendered/);
  }
  assert.match(readFileSync(new URL('../dist/spa.html', import.meta.url), 'utf8'), /noindex, follow/);
});

test('unknown routes have a static noindex error page and public trailing slashes keep their canonical', () => {
  const html = readFileSync(new URL('../dist/404.html', import.meta.url), 'utf8');
  assert.match(html, /<h1[^>]*>Page not found<\/h1>/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.equal(getRouteMetadata('/how-to-play/').canonical, 'https://wikiracr.com/how-to-play');
  assert.equal(getRouteMetadata('/how-to-play/').robots, 'index, follow');
  assert.equal(getRouteMetadata('/room/ABCD').robots, 'noindex, follow');
  assert.equal(getRouteMetadata('/not-a-real-page').robots, 'noindex, follow');
  assert.ok(!existsSync(new URL('../.prerender', import.meta.url)));
});
