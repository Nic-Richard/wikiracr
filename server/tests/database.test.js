const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { advanceClock } = require('../src/game/dailyClock');

test('daily timing persists independently of client progress and scores cannot be replaced', async t => {
  const pairs = new DatabaseSync(':memory:');
  const app = new DatabaseSync(':memory:');
  t.after(() => { pairs.close(); app.close(); });
  pairs.exec(`CREATE TABLE pairs (id INTEGER PRIMARY KEY, start_title TEXT, end_title TEXT,
    path_length INTEGER, tier TEXT, optimal_path TEXT);
    INSERT INTO pairs VALUES (1, 'Alpha', 'Charlie', 2, 'easy', '["Alpha","Bravo","Charlie"]');
    INSERT INTO pairs VALUES (2, 'Delta', 'Foxtrot', 2, 'easy', '["Delta","Echo","Foxtrot"]');`);
  let now = Date.now();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  function load() {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/db.js'), 'utf8'), {
      module, __dirname: path.resolve(__dirname, '../src'), Date: Clock,
      process: { env: { DB_PATH: 'pairs.db', APP_DB_PATH: 'app.db' } },
      require(name) {
        if (name === 'better-sqlite3') return class {
          constructor(filename) {
            const sqlite = filename.endsWith('pairs.db') ? pairs : app;
            return { exec: sql => sqlite.exec(sql), prepare: sql => sqlite.prepare(sql), pragma: value => sqlite.exec(`PRAGMA ${value}`),
              transaction: operation => () => {
                sqlite.exec('BEGIN');
                try { const result = operation(); sqlite.exec('COMMIT'); return result; }
                catch (error) { sqlite.exec('ROLLBACK'); throw error; }
              },
            };
          }
        };
        if (name === 'fs') return { readFileSync: () => '[]' };
        if (name === './lib/logger') return { debug() {}, info() {}, warn() {} };
        if (name === './game/dailyClock') return { advanceClock: (clock, active) => advanceClock(clock, active, now) };
        if (name === './lib/accountDeletionStore') return require('../src/lib/accountDeletionStore');
        return require(name);
      },
    });
    return module.exports;
  }
  let db = load();
  await db.initDb();
  assert.equal(db.getPair('easy', null, 1).id, 2);
  assert.equal(db.getPair('easy', 2, 1).id, 2);
  db.updateDailyClock('u1', '2026-10-05', true);
  now += 5000;
  db.updateDailyClock('u1', '2026-10-05', false);
  db.saveDailyProgress('u1', '2026-10-05', ['Alpha'], 0, 0, 1);
  assert.equal(db.getDailyProgress('u1', '2026-10-05').elapsedMs, 5000);
  db = load();
  await db.initDb();
  assert.equal(db.getDailyClock('u1', '2026-10-05').elapsedMs, 5000);
  now += 20_000;
  assert.equal(db.updateDailyClock('u1', '2026-10-05', true).elapsedMs, 5000);
  now += 3000;
  assert.equal(db.updateDailyClock('u1', '2026-10-05', false).elapsedMs, 8000);
  const score = { userId: 'u1', username: 'Player', date: '2026-10-05', score: 20, clicks: 2, timeSeconds: 8 };
  assert.equal(db.upsertDailyScore(score).changes, 1);
  assert.equal(db.upsertDailyScore({ ...score, score: 999 }).changes, 0);
  assert.equal(db.getUserDailyResult('u1', '2026-10-05').score, 20);
  for (const userId of ['u1', 'u2']) {
    db.saveGameHistory({ userId, pairId: 1, pathTaken: ['Alpha', 'Bravo', 'Charlie'], clicks: 2, timeSeconds: 8, completed: true, score: 20, mode: 'solo' });
    db.upsertDailyScore({ ...score, userId });
    db.saveDailyProgress(userId, score.date, ['Alpha'], 0, 0, 0);
    db.updateDailyClock(userId, score.date, true);
    db.upsertSpeedrunScore({ userId, username: 'Player', difficulty: 'easy', totalSeconds: 30, clicks: 4 });
    db.upsertHigherLowerStreak({ userId, username: 'Player', streak: 3 });
    db.saveReport({ userId, type: 'bug', message: 'Private report' });
  }
  db.applyEloResult({ userId: 'u1', username: 'One' }, { userId: 'u2', username: 'Two' });
  db.getDeletionStore().request('u1', ['u1@example.com']);
  db.deleteAccountData('u1');
  for (const table of ['game_history', 'daily_progress', 'daily_clock', 'leaderboard_daily', 'user_elo', 'speedrun_scores', 'higherlower_scores', 'reports']) {
    assert.equal(app.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?`).get('u1').n, 0);
    assert.equal(app.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?`).get('u2').n, 1);
  }
  assert.equal(db.upsertDailyScore(score), undefined);
  assert.equal(db.applyEloResult({ userId: 'u1', username: 'One' }, { userId: 'u2', username: 'Two' }), null);
  assert.equal(app.prepare('SELECT count(*) AS n FROM leaderboard_daily WHERE user_id = ?').get('u1').n, 0);
});
