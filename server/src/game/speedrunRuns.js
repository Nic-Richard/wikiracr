const crypto = require('crypto');
const { getPair, getDailyChallenge } = require('../db');
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
    pathLength: pair.path_length,
  };
}

function prune(now) {
  for (const [id, run] of runs) if (now - run.createdAt > RUN_TTL_MS) runs.delete(id);
  while (runs.size >= MAX_RUNS) runs.delete(runs.keys().next().value);
}

function issueRound(run, now) {
  const pair = getPair(run.difficulty, null, getDailyChallenge()?.id);
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
  if (!run || Date.now() - run.createdAt > RUN_TTL_MS) {
    runs.delete(String(runId || ''));
    throw new PathError('This speedrun has expired. Start a new one.', 404);
  }
  return run;
}

async function completeRound(round, entry, endedAt) {
  const hops = await verifyPath(entry?.path, round.pair.start_title, round.pair.end_title);
  checkClicks(entry.clicks, hops);
  const roundMs = Math.max(0, endedAt - round.startsAt);
  if (roundMs < hops * MIN_SECONDS_PER_CLICK * 1000) throw new PathError('Round time is not possible');
  const optimalPath = JSON.parse(round.pair.optimal_path);
  return { startTitle: round.pair.start_title, endTitle: round.pair.end_title,
    path: [...entry.path], clicks: entry.clicks, roundSeconds: Math.floor(roundMs / 1000),
    optimalPath, optimalClicks: optimalPath.length - 1 };
}

async function nextRound(runId, submitted) {
  const run = getRun(runId);
  if (run.checking) throw new PathError('This round is already being checked', 409);
  if (run.rounds.length >= SPEEDRUN_ROUNDS) throw new PathError('This speedrun has no more rounds');
  const now = Date.now();
  run.checking = true;
  try {
    const round = run.rounds[run.rounds.length - 1];
    const completedRound = await completeRound(round, submitted, now);
    // Start the next clock after validation so Wikipedia latency does not count as playing time.
    const pair = issueRound(run, Date.now());
    round.endedAt = now;
    round.completed = completedRound;
    return { pair, completedRound };
  } finally {
    run.checking = false;
  }
}

// Times each round on the server, from when it started to when the next pair (or the result) was asked for.
async function finishRun(runId, submitted) {
  const run = getRun(runId);
  if (run.checking) throw new PathError('This run is already being checked', 409);
  const now = Date.now();
  if (run.rounds.length !== SPEEDRUN_ROUNDS || !Array.isArray(submitted) || submitted.length !== SPEEDRUN_ROUNDS) {
    throw new PathError('This speedrun is not complete');
  }
  for (let i = 0; i < SPEEDRUN_ROUNDS - (run.result ? 0 : 1); i++) {
    const completed = run.rounds[i].completed;
    if (!completed || submitted[i]?.clicks !== completed.clicks
      || JSON.stringify(submitted[i]?.path) !== JSON.stringify(completed.path)) {
      throw new PathError('Round does not match the completed path');
    }
  }
  if (run.result) return run.result;
  run.checking = true;
  try {
    const last = run.rounds[run.rounds.length - 1];
    const completed = await completeRound(last, submitted[SPEEDRUN_ROUNDS - 1], now);
    const totalMs = run.rounds.slice(0, -1).reduce((sum, round) => sum + round.endedAt - round.startsAt, 0)
      + now - last.startsAt;
    const totalSeconds = Math.floor(totalMs / 1000);
    if (totalSeconds >= SPEEDRUN_TIMEOUT_SECONDS) throw new PathError('This speedrun ran out of time');
    last.endedAt = now;
    last.completed = completed;
    const rounds = run.rounds.map(round => round.completed);
    run.result = { difficulty: run.difficulty, totalSeconds, clicks: rounds.reduce((sum, round) => sum + round.clicks, 0), rounds };
    return run.result;
  } finally {
    run.checking = false;
  }
}

module.exports = { startRun, nextRound, finishRun, SPEEDRUN_ROUNDS };
