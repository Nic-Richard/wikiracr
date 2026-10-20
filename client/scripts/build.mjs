import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, loadEnv } from 'vite';
import { getRouteMetadata, KNOWN_PATHS } from '../src/lib/routeMetadata.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const staging = join(root, '.prerender');
if (dirname(staging) !== root || dirname(dist) !== root) throw new Error('Invalid build paths');
const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function pageTemplate(template, pathname, content) {
  const meta = getRouteMetadata(pathname);
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(meta.title)}</title>`);
  const replacements = {
    description: meta.description, robots: meta.robots,
    'og:title': meta.title, 'og:description': meta.description, 'og:url': meta.canonical,
    'twitter:title': meta.title, 'twitter:description': meta.description,
  };
  for (const [name, value] of Object.entries(replacements)) {
    const selector = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`(<meta (?:name|property)="${selector}" content=")[^"]*("[^>]*>)`), (_, before, after) => before + escape(value) + after);
  }
  html = html.replace(/(<link rel="canonical" href=")[^"]*("[^>]*>)/, (_, before, after) => before + escape(meta.canonical) + after);
  return content === null ? html : html.replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${content}</div>`);
}

await build({ root });
const template = await readFile(join(dist, 'index.html'), 'utf8');
if (!template.includes('<div id="root"></div>')) throw new Error('Missing prerender outlet');
const environment = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const publishableKey = environment.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_cHJlcmVuZGVyLmNsZXJrLmFjY291bnRzLmRldiQ';
try {
  await build({ root, build: { ssr: 'src/entry-server.jsx', outDir: staging, emptyOutDir: true } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Prerendering must not make network requests'); };
  try {
    const { render, prerenderPaths } = await import(pathToFileURL(join(staging, 'entry-server.js')));
    for (const pathname of new Set([...KNOWN_PATHS, ...prerenderPaths])) {
      const content = prerenderPaths.includes(pathname) ? render(pathname, publishableKey) : null;
      const destination = pathname === '/' ? join(dist, 'index.html')
        : pathname === '/404' ? join(dist, '404.html') : join(dist, pathname.slice(1), 'index.html');
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, pageTemplate(template, pathname, content));
    }
    await writeFile(join(dist, 'spa.html'), pageTemplate(template, '/game', null));
    console.log(`Prerendered ${prerenderPaths.length} public/error pages; other routes keep the client app.`);
  } finally { globalThis.fetch = originalFetch; }
} finally { await rm(staging, { recursive: true, force: true }); }
