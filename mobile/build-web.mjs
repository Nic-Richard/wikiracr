import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const mobile = dirname(fileURLToPath(import.meta.url));
const client = resolve(mobile, '../client');
const envPath = resolve(client, '.env');
const envFile = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const key = process.env.VITE_CLERK_PUBLISHABLE_KEY || envFile.match(/^VITE_CLERK_PUBLISHABLE_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
if (!key?.startsWith('pk_live_')) throw new Error('Set a production Clerk publishable key for the Android build.');
const environment = { ...process.env, VITE_SERVER_URL: 'https://wikiracr.com', VITE_CLERK_PUBLISHABLE_KEY: key };
execFileSync(process.execPath, [resolve(client, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', resolve(mobile, 'www'), '--emptyOutDir'], { cwd: client, stdio: 'inherit', env: environment });
