#!/usr/bin/env node

const assert = require('assert');
const path = require('path');

const dbPath = path.resolve(__dirname, '../src/db.js');
const pair = {
  id: 1,
  start_title: 'Alpha',
  end_title: 'Charlie',
  path_length: 2,
  optimal_path: JSON.stringify(['Alpha', 'Bravo', 'Charlie']),
};
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    getPair: () => pair,
    getCustomPair: () => pair,
    applyEloResult: (winner, loser) => ({
      winner: { ...winner, before: 1200, after: 1216, delta: 16, isPlacement: false },
      loser: { ...loser, before: 1200, after: 1184, delta: -16, isPlacement: false },
    }),
  },
};

const Room = require('../src/game/Room');
const gm = require('../src/game/GameManager');
const { calcScore, calcKnockoutDamage } = require('../src/game/scoring');
const { sanitizeDefaultRoomOptions, sanitizeCustomRoomOptions } = require('../src/socket/roomOptions');

function makeRoom(mode, options = {}) {
  const room = new Room(`TEST_${mode}_${Math.random().toString(36).slice(2)}`, 'p1', {
    mode,
    rounds: options.rounds ?? (mode === 'classic' ? 5 : 3),
    maxPlayers: options.maxPlayers ?? 2,
    hp: options.hp ?? 6000,
    immunityPercent: options.immunityPercent ?? 50,
    damageRampPercent: options.damageRampPercent ?? 5,
    matchmaking: options.matchmaking ?? false,
    ranked: options.ranked ?? false,
    isCustom: options.isCustom ?? false,
  });

  const count = options.players ?? 2;
  for (let i = 1; i <= count; i += 1) {
    const socketId = `p${i}`;
    room.addPlayer(socketId, { userId: `u${i}`, username: `Player ${i}` });
  }

  if (options.start !== false) {
    room.startMatch();
    room.startRound(pair);
  }
  return room;
}

function makeIo(socketIds = []) {
  const events = [];
  const sockets = new Map();
  for (const id of socketIds) {
    sockets.set(id, {
      id,
      joined: new Set(),
      emitted: [],
      join(code) { this.joined.add(code); },
      leave(code) { this.joined.delete(code); },
      emit(event, payload) { this.emitted.push({ event, payload }); events.push({ target: id, event, payload }); },
    });
  }
  return {
    events,
    sockets: { sockets },
    to(code) {
      return {
        emit(event, payload) { events.push({ target: code, event, payload }); },
      };
    },
  };
}

function player(room, socketId) {
  const p = room.players.get(socketId);
  assert(p, `missing player ${socketId}`);
  return p;
}

function finish(room, socketId, { score = 0, clicks = 0, seconds = 30, gaveUp = false } = {}) {
  const p = player(room, socketId);
  p.finished = true;
  p.finishTime = room.startTime + seconds * 1000;
  p.score = score;
  p.clicks = clicks;
  p.gaveUp = gaveUp;
  return p;
}

function lastRound(room) {
  return room.roundHistory[room.roundHistory.length - 1];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('additive scoring keeps click and time value independent', () => {
  assert.strictEqual(calcScore(2, 2, 0), 1_200_000);
  assert.strictEqual(calcScore(2, 2, 300), 720_000);
  assert.strictEqual(calcScore(12, 2, 0), 480_000);
  assert.strictEqual(calcScore(12, 2, 300), 0);
});

test('classic awards the round by highest score and tracks total score', () => {
  const room = makeRoom('classic');
  finish(room, 'p1', { score: 900_000, clicks: 4 });
  finish(room, 'p2', { score: 700_000, clicks: 2 });

  const result = room.finishRound();

  assert.strictEqual(result.matchOver, false);
  assert.strictEqual(player(room, 'p1').roundWins, 1);
  assert.strictEqual(player(room, 'p2').roundWins, 0);
  assert.strictEqual(player(room, 'p1').totalScore, 900_000);
  assert.strictEqual(player(room, 'p2').totalScore, 700_000);
  assert.strictEqual(lastRound(room).winnerSocketId, 'p1');
});

test('classic 1v1 forfeit awards the other player the round', () => {
  const room = makeRoom('classic');
  finish(room, 'p1', { score: 0, gaveUp: true });

  room.finishRound({ winnerSocketId: 'p2', loserSocketId: 'p1' });

  assert.strictEqual(player(room, 'p2').roundWins, 1);
  assert.strictEqual(lastRound(room).winnerSocketId, 'p2');
});

test('score mode totals round scores without awarding round wins', () => {
  const room = makeRoom('score');
  finish(room, 'p1', { score: 600_000 });
  finish(room, 'p2', { score: 500_000 });

  room.finishRound();

  assert.strictEqual(player(room, 'p1').roundWins, 0);
  assert.strictEqual(player(room, 'p2').roundWins, 0);
  assert.strictEqual(player(room, 'p1').totalScore, 600_000);
  assert.strictEqual(player(room, 'p2').totalScore, 500_000);
  assert.strictEqual(lastRound(room).winnerSocketId, 'p1');
});

test('clicks mode ignores score and chooses fewest clicks', () => {
  const room = makeRoom('clicks');
  finish(room, 'p1', { score: 1_000_000, clicks: 6 });
  finish(room, 'p2', { score: 100_000, clicks: 3 });

  room.finishRound();

  assert.strictEqual(player(room, 'p1').totalClicks, 6);
  assert.strictEqual(player(room, 'p2').totalClicks, 3);
  assert.strictEqual(lastRound(room).winnerSocketId, 'p2');
});

test('speedrun mode ignores score and chooses fastest finish time', () => {
  const room = makeRoom('speedrun');
  finish(room, 'p1', { score: 1_000_000, clicks: 2, seconds: 80 });
  finish(room, 'p2', { score: 10_000, clicks: 9, seconds: 40 });

  room.finishRound();

  assert.strictEqual(player(room, 'p1').totalTimeSeconds, 80);
  assert.strictEqual(player(room, 'p2').totalTimeSeconds, 40);
  assert.strictEqual(lastRound(room).winnerSocketId, 'p2');
});

test('speedrun keeps the round alive if one racer has not given up', () => {
  const room = makeRoom('speedrun', { players: 3, maxPlayers: 3 });
  finish(room, 'p1', { gaveUp: true });
  finish(room, 'p2', { gaveUp: true });

  const stillPlaying = room.activePlayers().filter(p => !p.finished);

  assert.strictEqual(room.options.mode, 'speedrun');
  assert.strictEqual(stillPlaying.length, 1);
  assert.strictEqual(stillPlaying[0].socketId, 'p3');
  assert.strictEqual(room.allFinished(), false);
});

test('knockout damage scales by distance below the safety cutoff', () => {
  assert.strictEqual(calcKnockoutDamage(400_000, 1_000_000, 1), 400);
  assert.strictEqual(calcKnockoutDamage(900_000, 1_000_000, 1), 900);
  assert.strictEqual(calcKnockoutDamage(400_000, 1_000_000, 1.1), 440);

  const room = makeRoom('knockout', { hp: 6000, immunityPercent: 50 });
  finish(room, 'p1', { score: 1_000_000 });
  finish(room, 'p2', { score: 600_000 });

  room.finishRound();

  assert.strictEqual(lastRound(room).winnerSocketId, 'p1');
  assert.strictEqual(player(room, 'p2').lastDamage, 400);
  assert.strictEqual(player(room, 'p2').hp, 5600);
  assert.strictEqual(player(room, 'p2').lastDamageFormula.cutoffScore, 1_000_000);
});

test('disconnected players sort below active players in final results', () => {
  const room = makeRoom('classic');
  player(room, 'p1').roundWins = 1;
  player(room, 'p1').totalScore = 500_000;
  player(room, 'p2').roundWins = 4;
  player(room, 'p2').totalScore = 2_000_000;
  player(room, 'p2').disconnected = true;

  const results = room.getResults();

  assert.strictEqual(results.players[0].socketId, 'p1');
  assert.strictEqual(results.winnerSocketId, 'p1');
});

test('skip voting requires strictly more than half of active players', () => {
  const room = makeRoom('classic', { players: 3, maxPlayers: 3 });

  const first = room.voteSkip('p1');
  assert.strictEqual(first.reached, false);
  assert.strictEqual(first.required, 2);

  const second = room.voteSkip('p2');
  assert.strictEqual(second.reached, true);
  assert.strictEqual(second.required, 2);
});

test('default room options only allow difficulty', () => {
  const ok = sanitizeDefaultRoomOptions({ difficulty: 'hard' });
  assert.strictEqual(ok.error, undefined);
  assert.strictEqual(ok.options.mode, 'classic');
  assert.strictEqual(ok.options.difficulty, 'hard');
  assert.strictEqual(ok.options.isCustom, false);

  const invalidDifficulty = sanitizeDefaultRoomOptions({ difficulty: 'moon' });
  assert.strictEqual(invalidDifficulty.options.difficulty, 'random');

  const rejected = sanitizeDefaultRoomOptions({ difficulty: 'easy', mode: 'knockout' });
  assert.ok(rejected.error);
});

test('custom room options force custom state and ignore legacy score multiplier', () => {
  const options = sanitizeCustomRoomOptions({ difficulty: 'medium', mode: 'score', ranked: true, scoreMultiplier: 3 });

  assert.strictEqual(options.difficulty, 'medium');
  assert.strictEqual(options.mode, 'score');
  assert.strictEqual(options.isCustom, true);
  assert.strictEqual(options.ranked, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'scoreMultiplier'), false);
});

test('matchmade room ready toggles start the countdown once both players are ready', () => {
  const io = makeIo(['m1', 'm2']);
  const room = gm.createRoom('m1', { userId: 'mu1', username: 'Match 1' }, { difficulty: 'random', matchmaking: true });
  gm.joinRoom(room.code, 'm2', { userId: 'mu2', username: 'Match 2' });

  assert.strictEqual(gm.handleToggleReady(io, 'm1').ready, true);
  assert.strictEqual(room.state, 'lobby');
  assert.strictEqual(gm.handleToggleReady(io, 'm2').ready, true);
  assert.strictEqual(room.state, 'countdown');
});

test('matchmade room auto-start timer starts the countdown', async () => {
  const io = makeIo(['a1', 'a2']);
  const room = gm.createRoom('a1', { userId: 'au1', username: 'Auto 1' }, { difficulty: 'random', matchmaking: true });
  gm.joinRoom(room.code, 'a2', { userId: 'au2', username: 'Auto 2' });

  gm.armMatchmakingStartTimer(io, room.code, 1);
  assert.ok(room.lobbyAutoStartAt);
  await delay(15);

  assert.strictEqual(room.state, 'countdown');
});

test('matchmade room closes if a player leaves before start', () => {
  const io = makeIo(['l1', 'l2']);
  const room = gm.createRoom('l1', { userId: 'lu1', username: 'Leave 1' }, { difficulty: 'random', matchmaking: true });
  gm.joinRoom(room.code, 'l2', { userId: 'lu2', username: 'Leave 2' });
  gm.armMatchmakingStartTimer(io, room.code, 30000);

  const result = gm.leaveRoom('l2', io);

  assert.strictEqual(result.cancelled, true);
  assert.strictEqual(gm.getRoom(room.code), undefined);
  assert.ok(io.events.some(e => e.event === 'match-cancelled'));
});

test('reconnect only restores a player when they return to the same room', () => {
  const io = makeIo(['r1', 'r2', 'r3']);
  const room = gm.createRoom('r1', { userId: 'ru1', username: 'Reconnect 1' }, { difficulty: 'random' });
  gm.joinRoom(room.code, 'r2', { userId: 'ru2', username: 'Reconnect 2' });
  gm.createRoom('r3', { userId: 'ru3', username: 'Other Room' }, { difficulty: 'random' });

  const old = player(room, 'r1');
  old.disconnected = true;
  const socket = { id: 'r1-new', user: { userId: 'ru1', username: 'Reconnect 1' }, join: code => io.events.push({ target: 'r1-new', event: 'join', payload: code }) };

  const wrongRoom = gm.attemptReconnect(io, socket, 'BADCODE');
  assert.strictEqual(wrongRoom, null);
  assert.strictEqual(room.players.has('r1'), true);

  const restored = gm.attemptReconnect(io, socket, room.code);
  assert.strictEqual(restored.code, room.code);
  assert.strictEqual(room.players.has('r1'), false);
  assert.strictEqual(room.players.has('r1-new'), true);
  assert.strictEqual(player(room, 'r1-new').disconnected, false);
});

(async () => {
  let passed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}`);
      console.error(err.stack || err);
      process.exit(1);
    }
  }

  console.log(`\n${passed}/${tests.length} room smoke tests passed.`);
})().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
