const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { advanceClock } = require('../src/game/dailyClock');
const { PathError, checkClicks } = require('../src/game/pathCheck');

const pair = { id: 1, start_title: 'Alpha', end_title: 'Charlie', path_length: 2,
  optimal_path: JSON.stringify(['Alpha', 'Bravo', 'Charlie']) };
const entry = { clicks: 2, path: ['Alpha', 'Bravo', 'Charlie'] };

async function verifyPath(titles, start, end) {
  if (!Array.isArray(titles) || titles[0] !== start || titles.at(-1) !== end
    || JSON.stringify(titles) !== JSON.stringify(entry.path)) throw new PathError('Invalid path');
  return 2;
}

function loadModule(filename, dependencies, extra = {}) {
  const module = { exports: {} };
  const localRequire = createRequire(path.resolve(__dirname, filename));
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, filename), 'utf8'), {
    module, require(name) { return name in dependencies ? dependencies[name] : localRequire(name); },
    ...extra,
  });
  return module.exports;
}

test('daily clock pauses, resumes, and caps time after a lost connection', () => {
  let clock = advanceClock(null, true, 1000);
  clock = advanceClock(clock, false, 6000);
  assert.equal(clock.elapsedMs, 5000);
  clock = advanceClock(clock, true, 9000);
  assert.equal(clock.elapsedMs, 5000);
  clock = advanceClock(clock, true, 10_000);
  assert.equal(clock.elapsedMs, 6000);
  clock = advanceClock(clock, false, 200_000);
  assert.equal(clock.elapsedMs, 36_000);
  assert.equal(clock.activeAt, null);
});

function speedrun(verify = verifyPath) {
  let now = 100_000;
  class Clock extends Date { static now() { return now; } }
  const api = loadModule('../src/game/speedrunRuns.js', {
    '../db': { getPair: () => pair, getDailyChallenge: () => ({ id: 99 }) },
    './pathCheck': { verifyPath: verify, checkClicks, PathError, MIN_SECONDS_PER_CLICK: 1 },
  }, { Date: Clock });
  return { api, advance(ms) { now += ms; } };
}

test('speedrun answers are hidden until each round is verified', async () => {
  const { api, advance } = speedrun();
  const start = api.startRun('easy');
  assert.equal(start.pair.optimalPath, undefined);
  advance(10_000);
  await assert.rejects(api.nextRound(start.runId, { clicks: 2, path: ['Alpha', 'Charlie'] }), /Invalid path/);
  const next = await api.nextRound(start.runId, entry);
  assert.equal(next.pair.optimalPath, undefined);
  assert.equal(next.completedRound.optimalPath.join(','), entry.path.join(','));
});

test('instant rounds and expired runs cannot advance', async () => {
  const { api, advance } = speedrun();
  const start = api.startRun('easy');
  await assert.rejects(api.nextRound(start.runId, entry), /not possible/);
  advance(60 * 60 * 1000 + 1);
  await assert.rejects(api.nextRound(start.runId, entry), /expired/);
});

test('simultaneous advances cannot skip a speedrun round', async () => {
  let release;
  const { api, advance } = speedrun(() => new Promise(resolve => { release = resolve; }));
  const start = api.startRun('easy');
  advance(10_000);
  const first = api.nextRound(start.runId, entry);
  await assert.rejects(api.nextRound(start.runId, entry), /already being checked/);
  release(2);
  await first;
});

test('speedrun results preserve comparisons and cannot replace verified rounds', async () => {
  const { api, advance } = speedrun();
  const { runId } = api.startRun('easy');
  const submitted = Array.from({ length: 5 }, () => ({ ...entry, path: [...entry.path] }));
  for (let i = 0; i < 4; i++) {
    advance(10_000);
    await api.nextRound(runId, entry);
  }
  advance(10_000);
  const tampered = submitted.map((round, i) => i === 0 ? { ...round, clicks: 3 } : round);
  await assert.rejects(api.finishRun(runId, tampered), /does not match/);
  const result = await api.finishRun(runId, submitted);
  assert.equal(result.rounds.length, 5);
  assert.equal(result.rounds[4].optimalPath.join(','), entry.path.join(','));
  assert.equal(result.clicks, 10);
  advance(5000);
  assert.equal((await api.finishRun(runId, submitted)).totalSeconds, result.totalSeconds);
  await assert.rejects(api.finishRun(runId, tampered), /does not match/);
});

function routes({ completed = false, elapsedMs = 10_000 } = {}) {
  const handlers = new Map();
  const saved = {};
  const today = new Date().toISOString().slice(0, 10);
  const db = {
    getPair: (difficulty, length, excludeId) => { saved.excludeId = excludeId; return pair; },
    getDailyChallenge: () => pair,
    getUserDailyResult: () => completed ? { clicks: 2, score: 10, time_seconds: 10 } : null,
    getUserStreak: () => 1,
    getDailyProgress: () => null,
    getDailyClock: () => ({ elapsedMs, activeAt: null }),
    updateDailyClock: (userId, date, active) => { saved.clock = { userId, date, active }; return { elapsedMs, activeAt: null }; },
    saveDailyProgress: (...args) => { saved.progress = args; },
    upsertDailyScore: score => { saved.score = score; return { changes: 1 }; },
    clearDailyProgress() {},
    saveReport: report => { saved.report = report; },
  };
  loadModule('../src/routes/api.js', {
    express: { Router: () => ({
      get(route, ...fns) { handlers.set(`GET ${route}`, fns.at(-1)); },
      post(route, ...fns) { handlers.set(`POST ${route}`, fns.at(-1)); },
    }) },
    '../db': db,
    stripe: () => ({}),
    '../lib/clerk': {},
    '../lib/logger': { error() {} },
    '../lib/alerts': { sendAlert: (channel, alert) => { saved.alert = { channel, alert }; } },
    '../lib/rateLimit': { rateLimit: () => () => {} },
    '../middleware/auth': {},
    '../game/GameManager': {},
    '../lib/socketAuth': { accountName: async () => 'Player' },
    '../game/pathCheck': { verifyPath, checkClicks, MIN_SECONDS_PER_CLICK: 1 },
    '../game/speedrunRuns': {},
    '../game/higherLower': {},
    '../game/scoring': { calcScore: (clicks, optimal, seconds) => 1000 - seconds },
  }, { process });
  async function request(method, route, body = {}) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    await handlers.get(`${method} ${route}`)({ userId: 'u1', body, query: {}, params: {} }, res);
    return res;
  }
  return { request, saved, today };
}

test('daily and unfinished status responses contain no answer', async () => {
  const { request, saved } = routes();
  assert.equal((await request('GET', '/daily')).body.pair.optimalPath, undefined);
  assert.equal((await request('GET', '/daily/status')).body.pair, null);
  await request('GET', '/pair');
  assert.equal(saved.excludeId, pair.id);
});

test('completed daily status retains the result comparison', async () => {
  const { request } = routes({ completed: true });
  assert.equal((await request('GET', '/daily/status')).body.pair.optimalPath.join(','), entry.path.join(','));
});

test('guests only receive the daily answer after a valid completion', async () => {
  const { request, today } = routes();
  assert.equal((await request('POST', '/daily/finish', { date: today, path: ['Alpha', 'Charlie'], clicks: 1 })).statusCode, 400);
  const res = await request('POST', '/daily/finish', { date: today, ...entry });
  assert.equal(res.body.optimalPath.join(','), entry.path.join(','));
});

test('daily scores use server time instead of the submitted time', async () => {
  const { request, saved, today } = routes();
  const res = await request('POST', '/leaderboard/daily', { date: today, ...entry, timeSeconds: 2 });
  assert.equal(res.statusCode, 200);
  assert.equal(saved.score.timeSeconds, 10);
  assert.equal(saved.score.score, 990);
  assert.equal(res.body.timeSeconds, 10);
});

test('daily clocks and progress reject malformed requests and browser time', async () => {
  const { request, saved, today } = routes();
  assert.equal((await request('POST', '/daily/clock', { date: today, active: 'yes' })).statusCode, 400);
  assert.equal((await request('POST', '/daily/clock', { date: '2000-01-01', active: true })).statusCode, 400);
  assert.equal((await request('POST', '/daily/progress', { navHist: ['Alpha'], histIdx: 5, clicks: 0 })).statusCode, 400);
  const res = await request('POST', '/daily/progress', { navHist: ['Alpha'], histIdx: 0, clicks: 0, elapsedMs: 1 });
  assert.equal(res.statusCode, 200);
  assert.equal(saved.progress[5], 10_000);
});

test('article reports require a title and route to moderation without blocking automatically', async () => {
  const { request, saved } = routes();
  assert.equal((await request('POST', '/report', { type: 'article', message: 'Review this' })).statusCode, 400);
  assert.equal(saved.report, undefined);
  assert.equal((await request('POST', '/report', { type: 'article', message: {}, context: { articleTitle: 'Alpha' } })).statusCode, 400);
  const response = await request('POST', '/report', { type: 'article', message: 'Review this', context: { articleTitle: 'Alpha', page: 'article' } });
  assert.equal(response.body.ok, true);
  assert.equal(saved.report.context.articleTitle, 'Alpha');
  assert.equal(saved.report.userId, 'u1');
  assert.equal(saved.alert.channel, 'reports');
  assert.equal(saved.alert.alert.title, 'Article report');
});
