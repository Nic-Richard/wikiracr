#!/usr/bin/env node
// Plays many multiplayer races at once against a local server over real Socket.IO connections.
// Usage: node scripts/stress-rooms.js [--rooms 50] [--players 2] [--clicks 4]
// Wikipedia link checks are stubbed and player data goes to a temporary database.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(process.argv[index + 1]);
};
const ROOMS = arg('rooms', 50);
const PLAYERS = arg('players', 2);
const CLICKS = arg('clicks', 4);
const PORT = arg('port', 39000 + Math.floor(Math.random() * 1000));
const TIMEOUT_MS = arg('timeout', 180) * 1000;
const VERBOSE = process.argv.includes('--verbose');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const latencies = [];
const errors = [];
let peakRss = 0;

function emit(socket, event, payload) {
  const started = performance.now();
  return new Promise(resolve => {
    const reply = result => { latencies.push(performance.now() - started); resolve(result || {}); };
    if (payload === undefined) socket.timeout(10_000).emit(event, (err, result) => reply(err ? { ok: false, error: 'timeout' } : result));
    else socket.timeout(10_000).emit(event, payload, (err, result) => reply(err ? { ok: false, error: 'timeout' } : result));
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${PORT}`, { transports: ['websocket'], forceNew: true, reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function playRoom(index) {
  const sockets = await Promise.all(Array.from({ length: PLAYERS }, connect));
  const [host] = sockets;
  if (VERBOSE && index === 0) {
    const t0 = performance.now();
    host.onAny((event, payload) => console.log(`${((performance.now() - t0) / 1000).toFixed(1)}s ${event} ${JSON.stringify(payload).slice(0, 140)}`));
  }
  const created = await emit(host, 'create-room', { difficulty: 'easy' });
  if (!created.ok) throw new Error(`create-room: ${created.error}`);
  const code = created.state.code;
  for (const socket of sockets.slice(1)) {
    const joined = await emit(socket, 'join-room', { code });
    if (!joined.ok) throw new Error(`join-room: ${joined.error}`);
  }

  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`room ${index} timed out`)), TIMEOUT_MS);
    host.on('game-over', () => { clearTimeout(timer); resolve(); });
    host.on('room-error', ({ error }) => { clearTimeout(timer); reject(new Error(error)); });
  });
  for (const socket of sockets) {
    socket.on('game-started', async ({ pair }) => {
      for (let click = 1; click < CLICKS; click += 1) {
        await sleep(50 + Math.random() * 250);
        const moved = await emit(socket, 'click-link', { to: `Stress article ${index}-${click}` });
        if (!moved.ok) errors.push(`click-link: ${moved.error || 'rejected'}`);
      }
      const finished = await emit(socket, 'click-link', { to: pair.endTitle.replace(/_/g, ' ') });
      if (!finished.ok) errors.push(`finish: ${finished.error || 'rejected'}`);
    });
    socket.on('round-over', () => setTimeout(() => emit(socket, 'continue-round'), 100 + Math.random() * 300));
  }

  const started = await emit(host, 'start-game', { code });
  if (!started.ok) throw new Error(`start-game: ${started.error}`);
  await done;
  for (const socket of sockets) socket.close();
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiracr-stress-'));
  const server = spawn(process.execPath, ['-r', './scripts/stress/offline-links.js', 'src/index.js'], {
    cwd: root,
    env: {
      ...process.env, PORT: String(PORT), NODE_ENV: 'production', CLIENT_URL: 'http://localhost',
      APP_DB_PATH: path.join(temp, 'app.db'), DB_PATH: path.resolve(root, '../data/pairs.db'),
      HIGHERLOWER_PATH: path.resolve(root, '../data/higherlower_articles.json'),
      ALERTS_URL: '', CLERK_SECRET_KEY: '', STRIPE_SECRET_KEY: '', PLAY_BILLING_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready;
  const listening = new Promise(resolve => { ready = resolve; });
  server.stdout.on('data', chunk => {
    for (const line of String(chunk).split('\n')) {
      if (line.includes('Server running')) ready();
      const rss = /STRESS_RSS (\d+)/.exec(line);
      if (rss) peakRss = Math.max(peakRss, Number(rss[1]));
    }
  });
  server.stderr.on('data', chunk => process.stderr.write(chunk));

  try {
    await Promise.race([listening, sleep(15_000).then(() => { throw new Error('server did not start'); })]);
    const started = performance.now();
    const results = await Promise.allSettled(Array.from({ length: ROOMS }, (_, i) => playRoom(i)));
    const seconds = (performance.now() - started) / 1000;
    const failed = results.filter(r => r.status === 'rejected');
    latencies.sort((a, b) => a - b);
    const pct = p => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]?.toFixed(1);
    console.log(`${ROOMS} rooms x ${PLAYERS} players: ${ROOMS - failed.length} finished, ${failed.length} failed in ${seconds.toFixed(1)}s`);
    console.log(`${latencies.length} acknowledged events: p50 ${pct(0.5)}ms, p95 ${pct(0.95)}ms, max ${pct(1)}ms`);
    console.log(`peak server memory ${peakRss} MB; ${errors.length} rejected events`);
    for (const message of [...new Set([...failed.map(r => r.reason.message), ...errors])].slice(0, 10)) console.log(`  ${message}`);
    process.exitCode = failed.length || errors.length ? 1 : 0;
  } finally {
    server.kill();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exit(1); });
