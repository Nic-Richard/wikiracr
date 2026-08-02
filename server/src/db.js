const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');
const log  = require('./lib/logger');

let db;
let appDb;
let higherLowerTitles = [];

const TIER_NAMES = ['easy', 'medium', 'hard', 'expert'];

function initDb() {
  const pairsPath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, '../../pairs.db');
  const appPath = process.env.APP_DB_PATH
    ? path.resolve(process.env.APP_DB_PATH)
    : path.join(__dirname, '../../app.db');

  db = new Database(pairsPath);
  db.pragma('journal_mode = WAL');

  appDb = new Database(appPath);
  appDb.pragma('journal_mode = WAL');
  appDb.pragma('foreign_keys = ON');

  appDb.exec(`
    CREATE TABLE IF NOT EXISTS game_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT    NOT NULL,
      pair_id      INTEGER NOT NULL,
      path_taken   TEXT    NOT NULL,
      clicks       INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      completed    INTEGER NOT NULL,
      score        INTEGER NOT NULL,
      mode         TEXT    NOT NULL,
      room_id      TEXT,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_challenge (
      date    TEXT    PRIMARY KEY,
      pair_id INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_progress (
      user_id    TEXT    NOT NULL,
      date       TEXT    NOT NULL,
      nav_hist   TEXT    NOT NULL,
      hist_idx   INTEGER NOT NULL,
      clicks     INTEGER NOT NULL,
      elapsed_ms INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS leaderboard_daily (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      username   TEXT    NOT NULL,
      date       TEXT    NOT NULL,
      score      INTEGER NOT NULL,
      clicks     INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_history_user ON game_history (user_id);
    CREATE INDEX IF NOT EXISTS idx_history_pair ON game_history (pair_id);

    CREATE TABLE IF NOT EXISTS user_elo (
      user_id    TEXT PRIMARY KEY,
      username   TEXT    NOT NULL,
      elo        INTEGER NOT NULL DEFAULT 1200,
      wins       INTEGER NOT NULL DEFAULT 0,
      losses     INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_elo_rating ON user_elo (elo);

    CREATE TABLE IF NOT EXISTS speedrun_scores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      username      TEXT    NOT NULL,
      difficulty    TEXT    NOT NULL,
      total_seconds INTEGER NOT NULL,
      clicks        INTEGER NOT NULL,
      created_at    INTEGER NOT NULL,
      UNIQUE (user_id, difficulty)
    );
    CREATE INDEX IF NOT EXISTS idx_speedrun_diff ON speedrun_scores (difficulty, total_seconds);

    CREATE TABLE IF NOT EXISTS higherlower_scores (
      user_id     TEXT    PRIMARY KEY,
      username    TEXT    NOT NULL,
      best_streak INTEGER NOT NULL DEFAULT 0,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT    NOT NULL,
      message    TEXT,
      context    TEXT,
      user_id    TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  const dailyProgressCols = appDb.prepare('PRAGMA table_info(daily_progress)').all().map(c => c.name);
  if (!dailyProgressCols.includes('elapsed_ms')) {
    appDb.exec('ALTER TABLE daily_progress ADD COLUMN elapsed_ms INTEGER NOT NULL DEFAULT 0');
    log.info('[db] migrated daily_progress: added elapsed_ms column');
  }

  loadHigherLowerArticles();

  return Promise.resolve();
}

function loadHigherLowerArticles() {
  const jsonPath = process.env.HIGHERLOWER_PATH
    ? path.resolve(process.env.HIGHERLOWER_PATH)
    : path.join(__dirname, '../../higherlower_articles.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    higherLowerTitles = parsed.map(r => r.title);
    log.debug(`[db] loaded ${higherLowerTitles.length.toLocaleString()} Higher/Lower articles from ${jsonPath}`);
  } catch (err) {
    log.debug(`[db] higherlower_articles.json unavailable: ${err.message}`);
    higherLowerTitles = [];
  }
}

function getHigherLowerArticles() {
  return higherLowerTitles;
}

function getPair(difficulty = 'random', pathLength = null) {

  if (pathLength !== null) {
    return db.prepare(
      'SELECT * FROM pairs WHERE path_length = ? ORDER BY RANDOM() LIMIT 1'
    ).get(pathLength);
  }

  const tier = TIER_NAMES.includes(difficulty) ? difficulty : TIER_NAMES[Math.floor(Math.random() * TIER_NAMES.length)];

  const pair = db.prepare(
    'SELECT * FROM pairs WHERE tier = ? ORDER BY RANDOM() LIMIT 1'
  ).get(tier);
  if (pair) return pair;

  log.warn(`[db] no pairs tagged tier="${tier}" yet, falling back to full pool`);
  return db.prepare('SELECT * FROM pairs ORDER BY RANDOM() LIMIT 1').get();
}

function getCustomPair(startTitle, endTitle) {
  return db.prepare(
    'SELECT * FROM pairs WHERE start_title = ? AND end_title = ? LIMIT 1'
  ).get(startTitle, endTitle);
}

function getDailyChallenge() {
  const today = new Date().toISOString().split('T')[0];
  let row = appDb.prepare('SELECT pair_id FROM daily_challenge WHERE date = ?').get(today);
  if (!row) {
    const pair = getPair('medium');
    if (!pair) return null;
    appDb.prepare('INSERT OR IGNORE INTO daily_challenge (date, pair_id) VALUES (?, ?)')
      .run(today, pair.id);
    return pair;
  }
  return db.prepare('SELECT * FROM pairs WHERE id = ?').get(row.pair_id);
}

function saveGameHistory(data) {
  return appDb.prepare(`
    INSERT INTO game_history
      (user_id, pair_id, path_taken, clicks, time_seconds, completed, score, mode, room_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.userId,
    data.pairId,
    JSON.stringify(data.pathTaken),
    data.clicks,
    data.timeSeconds,
    data.completed ? 1 : 0,
    data.score,
    data.mode,
    data.roomId || null,
    Date.now()
  );
}

function getUserStats(userId) {
  return appDb.prepare(`
    SELECT
      COUNT(*)                                          AS total_games,
      SUM(completed)                                    AS completed_games,
      ROUND(AVG(CASE WHEN completed = 1 THEN clicks END), 2) AS avg_clicks,
      MAX(CASE WHEN mode = 'solo' THEN score END)              AS best_score,
      COUNT(DISTINCT DATE(created_at / 1000, 'unixepoch')) AS days_played
    FROM game_history
    WHERE user_id = ?
  `).get(userId);
}

function getUserHistory(userId, limit = 20) {
  const rows = appDb.prepare(`
    SELECT * FROM game_history
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);

  if (!rows.length) return [];

  const pairIds = [...new Set(rows.map(r => r.pair_id))];
  const placeholders = pairIds.map(() => '?').join(',');
  const pairRows = db.prepare(
    `SELECT id, start_title, end_title, path_length FROM pairs WHERE id IN (${placeholders})`
  ).all(...pairIds);
  const pairById = new Map(pairRows.map(p => [p.id, p]));

  return rows.map(r => {
    const p = pairById.get(r.pair_id);
    return {
      ...r,
      start_title: p?.start_title ?? null,
      end_title:   p?.end_title ?? null,
      path_length: p?.path_length ?? null,
    };
  });
}

function getDailyLeaderboard(date) {
  const d = date || new Date().toISOString().split('T')[0];
  return appDb.prepare(`
    SELECT username, score, clicks, time_seconds
    FROM leaderboard_daily
    WHERE date = ?
    ORDER BY clicks ASC, time_seconds ASC
    LIMIT 100
  `).all(d);
}

function getUserDailyResult(userId, date) {
  const d = date || new Date().toISOString().split('T')[0];
  return appDb.prepare(
    'SELECT score, clicks, time_seconds FROM leaderboard_daily WHERE user_id = ? AND date = ?'
  ).get(userId, d);
}

function getDailyProgress(userId, date) {
  const row = appDb.prepare(
    'SELECT nav_hist, hist_idx, clicks, elapsed_ms FROM daily_progress WHERE user_id = ? AND date = ?'
  ).get(userId, date);
  if (!row) return null;
  return { navHist: JSON.parse(row.nav_hist), histIdx: row.hist_idx, clicks: row.clicks, elapsedMs: row.elapsed_ms };
}

function saveDailyProgress(userId, date, navHist, histIdx, clicks, elapsedMs) {
  appDb.prepare(`
    INSERT INTO daily_progress (user_id, date, nav_hist, hist_idx, clicks, elapsed_ms, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      nav_hist   = excluded.nav_hist,
      hist_idx   = excluded.hist_idx,
      clicks     = excluded.clicks,
      elapsed_ms = excluded.elapsed_ms,
      updated_at = excluded.updated_at
  `).run(userId, date, JSON.stringify(navHist), histIdx, clicks, elapsedMs || 0, Date.now());
}

function clearDailyProgress(userId, date) {
  appDb.prepare('DELETE FROM daily_progress WHERE user_id = ? AND date = ?').run(userId, date);
}

function getUserStreak(userId) {
  const rows = appDb.prepare(
    'SELECT date FROM leaderboard_daily WHERE user_id = ? ORDER BY date DESC'
  ).all(userId);
  if (!rows.length) return 0;

  const playedDates = new Set(rows.map(r => r.date));
  const oneDay = 24 * 60 * 60 * 1000;
  let cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  if (!playedDates.has(cursor.toISOString().split('T')[0])) {
    cursor = new Date(cursor.getTime() - oneDay);
  }

  let streak = 0;
  while (playedDates.has(cursor.toISOString().split('T')[0])) {
    streak += 1;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
}

function getUserBestStreak(userId) {
  const rows = appDb.prepare(
    'SELECT date FROM leaderboard_daily WHERE user_id = ? ORDER BY date ASC'
  ).all(userId);
  if (!rows.length) return 0;

  const oneDay = 24 * 60 * 60 * 1000;
  let best = 1, current = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].date).getTime();
    const cur  = new Date(rows[i].date).getTime();
    if (cur - prev === oneDay) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
  }
  return best;
}

function getUserSpeedrunBests(userId) {
  return appDb.prepare(
    'SELECT difficulty, total_seconds, clicks FROM speedrun_scores WHERE user_id = ?'
  ).all(userId);
}

function upsertDailyScore(data) {
  appDb.prepare(`
    INSERT INTO leaderboard_daily (user_id, username, date, score, clicks, time_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO NOTHING
  `).run(
    data.userId, data.username, data.date,
    data.score, data.clicks, data.timeSeconds, Date.now()
  );
}

const ELO_DEFAULT     = 1200;
const PLACEMENT_GAMES = 5;

function getKFactor(gamesPlayed) {
  if (gamesPlayed < PLACEMENT_GAMES) return 64;
  if (gamesPlayed < 30) return 40;
  return 24;
}

const RANK_TIERS = [
  { name: 'Bronze',    min: 0 },
  { name: 'Silver',    min: 1100 },
  { name: 'Gold',      min: 1300 },
  { name: 'Diamond',   min: 1500 },
  { name: 'Oracle',    min: 1700 },
];

function getRankName(elo) {
  let name = RANK_TIERS[0].name;
  for (const tier of RANK_TIERS) {
    if (elo >= tier.min) name = tier.name;
  }
  return name;
}

function getOrCreateElo(userId, username) {
  let row = appDb.prepare('SELECT * FROM user_elo WHERE user_id = ?').get(userId);
  if (!row) {
    appDb.prepare(
      'INSERT INTO user_elo (user_id, username, elo, wins, losses, updated_at) VALUES (?, ?, ?, 0, 0, ?)'
    ).run(userId, username, ELO_DEFAULT, Date.now());
    row = appDb.prepare('SELECT * FROM user_elo WHERE user_id = ?').get(userId);
  } else if (row.username !== username) {

    appDb.prepare('UPDATE user_elo SET username = ? WHERE user_id = ?').run(username, userId);
    row.username = username;
  }
  return row;
}

function calcEloDelta(ratingA, ratingB, scoreA, kA) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(kA * (scoreA - expectedA));
}

function applyEloResult(winner, loser) {
  const w = getOrCreateElo(winner.userId, winner.username);
  const l = getOrCreateElo(loser.userId, loser.username);

  const wGamesBefore = w.wins + w.losses;
  const lGamesBefore = l.wins + l.losses;

  const winnerDelta = calcEloDelta(w.elo, l.elo, 1, getKFactor(wGamesBefore));
  const loserDelta  = calcEloDelta(l.elo, w.elo, 0, getKFactor(lGamesBefore));

  const newWinnerElo = w.elo + winnerDelta;
  const newLoserElo  = Math.max(0, l.elo + loserDelta);

  appDb.prepare('UPDATE user_elo SET elo = ?, wins = wins + 1, updated_at = ? WHERE user_id = ?')
    .run(newWinnerElo, Date.now(), winner.userId);
  appDb.prepare('UPDATE user_elo SET elo = ?, losses = losses + 1, updated_at = ? WHERE user_id = ?')
    .run(newLoserElo, Date.now(), loser.userId);

  return {
    winner: {
      userId: winner.userId, before: w.elo, after: newWinnerElo, delta: newWinnerElo - w.elo,
      gamesPlayed: wGamesBefore + 1, isPlacement: (wGamesBefore + 1) < PLACEMENT_GAMES,
    },
    loser: {
      userId: loser.userId, before: l.elo, after: newLoserElo, delta: newLoserElo - l.elo,
      gamesPlayed: lGamesBefore + 1, isPlacement: (lGamesBefore + 1) < PLACEMENT_GAMES,
    },
  };
}

function getEloLeaderboard(limit = 100) {
  const rows = appDb.prepare(
    'SELECT username, elo, wins, losses FROM user_elo WHERE (wins + losses) >= ? ORDER BY elo DESC LIMIT ?'
  ).all(PLACEMENT_GAMES, limit);
  return rows.map(r => ({ ...r, rank: getRankName(r.elo) }));
}

function getUserElo(userId) {
  const row = appDb.prepare('SELECT * FROM user_elo WHERE user_id = ?').get(userId);
  const wins = row?.wins ?? 0;
  const losses = row?.losses ?? 0;
  const gamesPlayed = wins + losses;
  const isPlacement = gamesPlayed < PLACEMENT_GAMES;
  const elo = row?.elo ?? ELO_DEFAULT;
  return {
    elo, wins, losses, gamesPlayed, isPlacement,
    placementGamesRemaining: Math.max(0, PLACEMENT_GAMES - gamesPlayed),
    rank: isPlacement ? null : getRankName(elo),
  };
}

function upsertSpeedrunScore(data) {
  appDb.prepare(`
    INSERT INTO speedrun_scores (user_id, username, difficulty, total_seconds, clicks, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, difficulty) DO UPDATE SET
      total_seconds = MIN(total_seconds, excluded.total_seconds),
      clicks        = CASE WHEN excluded.total_seconds < total_seconds THEN excluded.clicks ELSE clicks END,
      username      = excluded.username
  `).run(data.userId, data.username, data.difficulty, data.totalSeconds, data.clicks, Date.now());
}

function getSpeedrunLeaderboard(difficulty, limit = 100) {
  return appDb.prepare(`
    SELECT username, total_seconds, clicks
    FROM speedrun_scores
    WHERE difficulty = ?
    ORDER BY total_seconds ASC
    LIMIT ?
  `).all(difficulty, limit);
}

function getHigherLowerBest(userId) {
  const row = appDb.prepare('SELECT best_streak FROM higherlower_scores WHERE user_id = ?').get(userId);
  return row ? row.best_streak : 0;
}

function upsertHigherLowerStreak(data) {
  appDb.prepare(`
    INSERT INTO higherlower_scores (user_id, username, best_streak, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      best_streak = MAX(best_streak, excluded.best_streak),
      username    = excluded.username,
      updated_at  = excluded.updated_at
  `).run(data.userId, data.username, data.streak, Date.now());
  return getHigherLowerBest(data.userId);
}

function saveReport(data) {
  appDb.prepare(`
    INSERT INTO reports (type, message, context, user_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.type, data.message || null, JSON.stringify(data.context || {}), data.userId || null, Date.now());
}

module.exports = {
  initDb,
  getPair,
  getCustomPair,
  getDailyChallenge,
  saveGameHistory,
  getUserStats,
  getUserHistory,
  getDailyLeaderboard,
  upsertDailyScore,
  getUserDailyResult,
  getDailyProgress,
  saveDailyProgress,
  clearDailyProgress,
  getUserStreak,
  getUserBestStreak,
  getUserSpeedrunBests,
  getHigherLowerArticles,
  applyEloResult,
  getEloLeaderboard,
  getUserElo,
  getRankName,
  upsertSpeedrunScore,
  getSpeedrunLeaderboard,
  getHigherLowerBest,
  upsertHigherLowerStreak,
  saveReport,
};
