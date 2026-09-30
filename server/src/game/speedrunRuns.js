const crypto = require('crypto');
const { getPair } = require('../db');
const { verifyPath, checkClicks, PathError, MIN_SECONDS_PER_CLICK } = require('./pathCheck');

const SPEEDRUN_ROUNDS = 5;
const SPEEDRUN_TIMEOUT_SECONDS = 900;
const RUN_TTL_MS = 60 * 60 * 1000;
const MAX_RUNS = 5000;
const runs = new Map();

// The client shows the first pair with a chip reveal and a 3-2-1 countdown before its clock starts;
// this mirrors that timing so the server clock starts at the same moment.
function firstRoundLeadInMs(pathLength) {
  return 3400 + (pathLength + 1) * 500;
}

function publicPair(pair) {
  return {
    id: pair.id, startTitle: pair.start_title, endTitle: pair.end_title,
    pathLength: pair.path_length, optimalPath: JSON.parse(pair.optimal_path),
  };
}

function prune(now) {
  for (const [id, run] of runs) if (now - run.createdAt > RUN_TTL_MS) runs.delete(id);
  while (runs.size >= MAX_RUNS) runs.delete(runs.keys().next().value);
}

function issueRound(run, now) {
  const pair = getPair(run.difficulty);
  if (!pair) throw new PathError('No pairs available for this difficulty', 404);
  const leadInMs = run.rounds.length === 0 ? firstRoundLeadInMs(pair.path_length) : 0;
  run.rounds.push({ pair, startsAt: now + leadInMs, endedAt: null });
  return publicPair(pair);
}

function startRun(difficulty) {
  const now = Date.now();
  prune(now);
  const run = { id: crypto.randomBytes(18).toString('base64url'), difficulty, createdAt: now, rounds: [] };
  const pair = issueRound(run, now);
  runs.set(run.id, run);
  return { runId: run.id, pair };
}

function getRun(runId) {
  const run = runs.get(String(runId || ''));
  if (!run) throw new PathError('This speedrun has expired. Start a new one.', 404);
  return run;
}

function nextRound(runId) {
  const run = getRun(runId);
  if (run.rounds.length >= SPEEDRUN_ROUNDS) throw new PathError('This speedrun has no more rounds');
  const now = Date.now();
  run.rounds[run.rounds.length - 1].endedAt = now;
  return { pair: issueRound(run, now) };
}

// Times each round on the server, from when it started to when the next pair (or the result) was asked for.
async function finishRun(runId, submitted) {
  const run = getRun(runId);
  const now = Date.now();
  if (run.rounds.length !== SPEEDRUN_ROUNDS || !Array.isArray(submitted) || submitted.length !== SPEEDRUN_ROUNDS) {
    throw new PathError('This speedrun is not complete');
  }
  const last = run.rounds[run.rounds.length - 1];
  last.endedAt = last.endedAt || now;

  let totalMs = 0;
  let totalClicks = 0;
  for (let i = 0; i < SPEEDRUN_ROUNDS; i++) {
    const round = run.rounds[i];
    const entry = submitted[i] || {};
    const hops = await verifyPath(entry.path, round.pair.start_title, round.pair.end_title);
    checkClicks(entry.clicks, hops);
    const roundMs = Math.max(0, round.endedAt - round.startsAt);
    if (roundMs < hops * MIN_SECONDS_PER_CLICK * 1000) throw new PathError('Round time is not possible');
    totalMs += roundMs;
    totalClicks += entry.clicks;
  }
  const totalSeconds = Math.floor(totalMs / 1000);
  runs.delete(run.id);
  if (totalSeconds >= SPEEDRUN_TIMEOUT_SECONDS) throw new PathError('This speedrun ran out of time');
  return { difficulty: run.difficulty, totalSeconds, clicks: totalClicks };
}

module.exports = { startRun, nextRound, finishRun, SPEEDRUN_ROUNDS };
