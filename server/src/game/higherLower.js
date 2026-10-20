const crypto = require('crypto');
const axios = require('axios');
const { getHigherLowerArticles } = require('../db');
const log = require('../lib/logger');

const GAME_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_GAMES = 5000;
const MAX_PICK_ATTEMPTS = 8;
const games = new Map();
const viewsCache = new Map();

class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function lastMonthRange() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const day = d => d.toISOString().slice(0, 10).replaceAll('-', '');
  return { start: day(first), end: day(last) };
}

async function monthlyViews(title) {
  const { start, end } = lastMonthRange();
  const key = `${title}|${start}`;
  if (viewsCache.has(key)) return viewsCache.get(key);
  try {
    const { data } = await axios.get(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(title)}/monthly/${start}/${end}`,
      { timeout: 8000, headers: { 'User-Agent': 'WikiRacr/1.0 (https://wikiracr.com; support@wikiracr.com)' } },
    );
    const views = data.items?.[0]?.views ?? null;
    if (viewsCache.size > 20000) viewsCache.clear();
    viewsCache.set(key, views);
    return views;
  } catch (err) {
    log.debug('[higherlower] views unavailable:', title, err.message);
    return null;
  }
}

function randomTitle(pool, exclude) {
  for (let i = 0; i < 20; i++) {
    const title = pool[Math.floor(Math.random() * pool.length)];
    if (!exclude.has(title)) return title;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function dealPair(game) {
  const pool = getHigherLowerArticles();
  if (pool.length < 2) throw new GameError('Higher or Lower is unavailable right now.', 503);
  if (game.seen.size > pool.length * 0.6) game.seen.clear();
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const a = randomTitle(pool, game.seen);
    const b = randomTitle(pool, new Set([...game.seen, a]));
    if (a === b) continue;
    const access = await Promise.all([a, b].map(title => require('../lib/articleAccess').articleAccess(title)));
    if (access.some(result => !result.allowed)) continue;
    const [viewsA, viewsB] = await Promise.all([monthlyViews(a), monthlyViews(b)]);
    if (viewsA === null || viewsB === null || viewsA === viewsB) continue;
    game.seen.add(a).add(b);
    game.pair = { a, b, viewsA, viewsB };
    game.answered = false;
    return { titleA: a, titleB: b };
  }
  throw new GameError('Could not load article data. Try again.', 503);
}

function prune(now) {
  for (const [id, game] of games) if (now - game.updatedAt > GAME_TTL_MS) games.delete(id);
  while (games.size >= MAX_GAMES) games.delete(games.keys().next().value);
}

async function startGame(userId) {
  const now = Date.now();
  prune(now);
  const game = { id: crypto.randomBytes(18).toString('base64url'), userId: userId || null, streak: 0, seen: new Set(), updatedAt: now };
  const pair = await dealPair(game);
  games.set(game.id, game);
  return { gameId: game.id, ...pair };
}

function getGame(gameId) {
  const game = games.get(String(gameId || ''));
  if (!game) throw new GameError('This game has expired. Start a new one.', 404);
  game.updatedAt = Date.now();
  return game;
}

// The views stay on the server until a guess is in, so the answer can't be read ahead of time.
function guess(gameId, pick) {
  const game = getGame(gameId);
  if (!game.pair || game.answered) throw new GameError('Guess already made for this pair');
  if (pick !== 'A' && pick !== 'B') throw new GameError('Pick A or B');
  const { viewsA, viewsB } = game.pair;
  const correct = pick === 'A' ? viewsA > viewsB : viewsB > viewsA;
  game.answered = true;
  if (correct) game.streak += 1;
  else games.delete(game.id);
  return { correct, viewsA, viewsB, streak: game.streak, userId: game.userId };
}

async function nextPair(gameId) {
  const game = getGame(gameId);
  if (!game.answered) throw new GameError('Make a guess first');
  return dealPair(game);
}

module.exports = { startGame, guess, nextPair, GameError,
  eraseAccount: userId => { for (const [id, game] of games) if (game.userId === userId) games.delete(id); },
};
