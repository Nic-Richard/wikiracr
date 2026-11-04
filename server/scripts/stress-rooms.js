#!/usr/bin/env node
// Plays many multiplayer races at once against a local server over real Socket.IO connections.
// Usage: node scripts/stress-rooms.js [--rooms 50] [--players 2] [--clicks 4] [--ramp 0] [--workers 1] [--think 0.3]
// Wikipedia link checks are stubbed and player data goes to a temporary database.

const { fork, spawn } = require('node:child_process');
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
// Spreads room starts over this many seconds; 0 starts every room at once.
const RAMP_MS = arg('ramp', 0) * 1000;
// Longest pause before each click, in seconds; real players read for a few seconds per article.
const THINK_MS = arg('think', 0.3) * 1000;
// Client processes the simulated players are split across, so the test isn't limited by one event loop.
const WORKERS = arg('workers', 1);
const WORKER = arg('worker', -1);
const VERBOSE = process.argv.includes('--verbose');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const latencies = [];
const errors = [];
let peakRss = 0;
let peakCpu = 0;
let peakLag = 0;
let liveRooms = 0;

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
    socket.once('connect_error', err => reject(new Error(`connect: ${err.message} ${err.description?.message || err.description || ''}`.trim())));
  });
}

async function playRoom(index) {
  const sockets = await Promise.all(Array.from({ length: PLAYERS }, connect));
  liveRooms += 1;
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
        await sleep(50 + Math.random() * (THINK_MS - 50));
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
  await done.finally(() => { liveRooms -= 1; });
  for (const socket of sockets) socket.close();
}

// Plays this worker's share of the rooms and reports back to the parent.
async function runWorker() {
  const mine = Array.from({ length: ROOMS }, (_, i) => i).filter(i => i % WORKERS === WORKER);
  const live = setInterval(() => process.send({ live: liveRooms }), 250);
  const results = await Promise.allSettled(mine.map(i => sleep(i * RAMP_MS / ROOMS).then(() => playRoom(i))));
  clearInterval(live);
  const failures = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
  process.send({ done: true, latencies, errors, failures }, () => process.exit(0));
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiracr-stress-'));
  // The server opens pairs.db for writing, so it gets a copy.
  fs.copyFileSync(path.resolve(root, '../data/pairs.db'), path.join(temp, 'pairs.db'));
  const server = spawn(process.execPath, ['-r', './scripts/stress/offline-links.js', 'src/index.js'], {
    cwd: root,
    env: {
      ...process.env, PORT: String(PORT), NODE_ENV: 'production', CLIENT_URL: 'http://localhost',
      APP_DB_PATH: path.join(temp, 'app.db'), DB_PATH: path.join(temp, 'pairs.db'),
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
      const stats = /STRESS_STATS (\d+) (\d+) (\d+)/.exec(line);
      if (stats) {
        peakRss = Math.max(peakRss, Number(stats[1]));
        peakCpu = Math.max(peakCpu, Number(stats[2]));
        peakLag = Math.max(peakLag, Number(stats[3]));
      }
    }
  });
  server.stderr.on('data', chunk => process.stderr.write(chunk));

  try {
    await Promise.race([listening, sleep(15_000).then(() => { throw new Error('server did not start'); })]);
    const started = performance.now();
    const live = new Array(WORKERS).fill(0);
    let peakLiveRooms = 0;
    const reports = await Promise.all(Array.from({ length: WORKERS }, (_, w) => new Promise((resolve, reject) => {
      const child = fork(__filename, [...process.argv.slice(2), '--worker', String(w), '--port', String(PORT)]);
      child.on('message', message => {
        if (message.done) return resolve(message);
        live[w] = message.live;
        peakLiveRooms = Math.max(peakLiveRooms, live.reduce((a, b) => a + b, 0));
      });
      child.on('exit', code => code && reject(new Error(`worker ${w} exited with ${code}`)));
    })));
    const seconds = (performance.now() - started) / 1000;
    const all = reports.flatMap(r => r.latencies).sort((a, b) => a - b);
    const failures = reports.flatMap(r => r.failures);
    const rejected = reports.flatMap(r => r.errors);
    const pct = p => all[Math.min(all.length - 1, Math.floor(all.length * p))]?.toFixed(1);
    console.log(`${ROOMS} rooms x ${PLAYERS} players over ${WORKERS} workers: ${ROOMS - failures.length} finished, ${failures.length} failed in ${seconds.toFixed(1)}s`);
    console.log(`${all.length} acknowledged events: p50 ${pct(0.5)}ms, p95 ${pct(0.95)}ms, max ${pct(1)}ms`);
    console.log(`peak ${peakLiveRooms} rooms in play at once; server peaks: ${peakRss} MB, ${peakCpu}% CPU, ${peakLag}ms event loop delay; ${rejected.length} rejected events`);
    for (const message of [...new Set([...failures, ...rejected])].slice(0, 10)) console.log(`  ${message}`);
    process.exitCode = failures.length || rejected.length ? 1 : 0;
  } finally {
    server.kill();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

(WORKER >= 0 ? runWorker() : main()).catch(error => { console.error(error.message); process.exit(1); });
