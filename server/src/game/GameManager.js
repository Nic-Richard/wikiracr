const Room = require('./Room');
const { getPair, getCustomPair, applyEloResult } = require('../db');
const { DISCONNECT_GRACE_MS } = require('./constants');
const log = require('../lib/logger');

const rooms = new Map();
const socketToRoom = new Map();

const disconnectTimers = new Map();
const lobbyStartTimers = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function applyEloIfEligible(room, results) {
  if (!room.options.ranked || results.players.length !== 2) return results;
  if (!results.winnerSocketId) return results;

  const winner = results.players.find(p => p.socketId === results.winnerSocketId);
  const loser  = results.players.find(p => p.socketId !== results.winnerSocketId);
  if (!winner?.userId || !loser?.userId) return results;

  const eloResult = applyEloResult(
    { userId: winner.userId, username: winner.username },
    { userId: loser.userId,  username: loser.username },
  );

  results.players = results.players.map(p => {
    if (p.userId === eloResult.winner.userId) return { ...p, elo: eloResult.winner };
    if (p.userId === eloResult.loser.userId)  return { ...p, elo: eloResult.loser };
    return p;
  });

  return results;
}

function createRoom(socketId, user, options = {}) {
  const code = generateCode();
  const room = new Room(code, socketId, options);
  room.addPlayer(socketId, user);
  rooms.set(code, room);
  socketToRoom.set(socketId, code);
  return room;
}

function joinRoom(code, socketId, user) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.state !== 'lobby') return { error: 'Game already in progress' };
  const added = room.addPlayer(socketId, user);
  if (!added) return { error: 'Room is full' };
  socketToRoom.set(socketId, code.toUpperCase());
  return { room };
}

function clearLobbyStartTimer(code) {
  const timer = lobbyStartTimers.get(code);
  if (timer) clearTimeout(timer);
  lobbyStartTimers.delete(code);
  const room = rooms.get(code);
  if (room) room.lobbyAutoStartAt = null;
}

async function startMatchmakingRoom(io, code) {
  const room = rooms.get(code);
  if (!room || room.state !== 'lobby' || !room.options.matchmaking) return;
  if (room.players.size < 2) return closeMatchmakingLobby(io, code, 'Opponent left before the match started.');
  clearLobbyStartTimer(code);
  room.startMatch();
  await startNextRound(io, code);
}

function armMatchmakingStartTimer(io, code, ms = 30000) {
  const room = rooms.get(code);
  if (!room || !room.options.matchmaking || room.state !== 'lobby') return;
  clearLobbyStartTimer(code);
  room.lobbyAutoStartAt = Date.now() + ms;
  io.to(code).emit('room-updated', room.getPublicState());
  lobbyStartTimers.set(code, setTimeout(() => startMatchmakingRoom(io, code), ms));
}

function closeMatchmakingLobby(io, code, message = 'Match cancelled.') {
  const room = rooms.get(code);
  if (!room) return null;
  clearLobbyStartTimer(code);
  io.to(code).emit('match-cancelled', { message });
  for (const socketId of room.players.keys()) {
    socketToRoom.delete(socketId);
    const s = io.sockets.sockets.get(socketId);
    if (s) s.leave(code);
  }
  rooms.delete(code);
  return { code, roomEmpty: true, cancelled: true };
}

function leaveRoom(socketId, io = null) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  room.removePlayer(socketId);
  socketToRoom.delete(socketId);
  if (room.state === 'lobby' && room.options.matchmaking && room.players.size < 2) {
    return io ? closeMatchmakingLobby(io, code, 'Opponent left before the match started.') : { code, roomEmpty: true };
  }
  if (room.players.size === 0) {
    if (room.endTimer) clearTimeout(room.endTimer);
    clearLobbyStartTimer(code);
    rooms.delete(code);
    return { code, roomEmpty: true };
  }
  return { code, room };
}

function handleDisconnect(io, socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  if (room.state === 'lobby' || room.state === 'results') {
    return leaveRoom(socketId, io);
  }

  const player = room.players.get(socketId);
  if (!player) return leaveRoom(socketId, io);

  player.disconnected = true;

  const graceExpiresAt = Date.now() + DISCONNECT_GRACE_MS;
  io.to(code).emit('player-moved', {
    socketId, username: player.username, clicks: player.clicks,
    finished: player.finished, score: player.score, disconnected: true,
    graceExpiresAt,
  });

  const timerKey = `${code}:${socketId}`;
  disconnectTimers.set(timerKey, setTimeout(() => finalizeForfeit(io, code, socketId), DISCONNECT_GRACE_MS));

  return { code, room, grace: true };
}

function finalizeForfeit(io, code, socketId) {
  disconnectTimers.delete(`${code}:${socketId}`);
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(socketId);
  if (!player || !player.disconnected) return;

  if (room.state === 'playing' && !player.finished) {
    player.finished   = true;
    player.finishTime = Date.now();
    player.score      = 0;
    io.to(code).emit('player-moved', {
      socketId, username: player.username, clicks: player.clicks,
      finished: true, score: 0, disconnected: true,
    });
  }

  room.recordElimination(player);
  player.hp = 0;
  socketToRoom.delete(socketId);

  io.to(code).emit('player-eliminated', { socketId, username: player.username, reason: 'disconnected' });

  const remaining = room.activePlayers();
  if (remaining.length <= 1) {
    if (room.endTimer) clearTimeout(room.endTimer);
    if (room.pair) {
      room.state = 'results';
      io.to(code).emit('game-over', applyEloIfEligible(room, room.getResults()));
    } else {

      room.resetForRematch();
      io.to(code).emit('room-updated', room.getPublicState());
    }
  } else if (room.state === 'playing' && room.allFinished()) {
    finishCurrentRound(io, code);
  } else {
    io.to(code).emit('room-updated', room.getPublicState());
  }
}

function attemptReconnect(io, socket, requestedCode = null) {
  const userId = socket.user?.userId;
  if (!userId) return null;
  const targetCode = requestedCode ? requestedCode.toUpperCase() : null;

  for (const [code, room] of rooms) {
    if (targetCode && code !== targetCode) continue;
    const found = room.findDisconnectedByUserId(userId);
    if (!found) continue;

    const timerKey = `${code}:${found.socketId}`;
    clearTimeout(disconnectTimers.get(timerKey));
    disconnectTimers.delete(timerKey);

    room.reattachPlayer(found.socketId, socket.id);
    socketToRoom.set(socket.id, code);
    socket.join(code);

    io.to(code).emit('room-updated', room.getPublicState());
    return { code, room };
  }
  return null;
}

async function startGame(io, code, socketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostSocketId !== socketId) return { error: 'Only the host can start' };
  if (room.state !== 'lobby') return { error: 'Game already started' };
  if (room.players.size < 2) return { error: 'Need at least 2 players to start' };

  room.startMatch();
  startNextRound(io, code);
  return { room };
}

async function beginRound(io, code, { consumesRoundSlot }) {
  const room = rooms.get(code);
  if (!room) return;

  let pair;
  if (room.options.customPair) {
    pair = getCustomPair(room.options.customPair.startTitle, room.options.customPair.endTitle);
  } else {
    pair = getPair(room.options.difficulty, room.options.pathLength);
  }
  if (!pair) {
    io.to(code).emit('room-error', { error: 'No pairs available for this difficulty' });
    return;
  }

  room.state = 'countdown';
  io.to(code).emit('game-countdown', {
    seconds:   3,
    roundNum:  consumesRoundSlot ? room.roundNum + 1 : room.roundNum,
    maxRounds: room.maxRounds,
    mode:      room.options.mode,
    standings: room.getStandings(),
    pair: {
      startTitle:  pair.start_title,
      endTitle:    pair.end_title,
      pathLength:  pair.path_length,
    },
  });

  await new Promise(r => setTimeout(r, 3000));

  if (!rooms.has(code)) return;

  if (consumesRoundSlot) {
    room.startRound(pair);
  } else {
    room.restartRoundAfterSkip(pair);
  }

  io.to(code).emit('game-started', {
    pair: { startTitle: pair.start_title, endTitle: pair.end_title },
    startTime: room.startTime,
    roundNum:  room.roundNum,
    maxRounds: room.maxRounds,
    options:   room.options,
  });

  if (room.options.timeout) {
    room.endTimer = setTimeout(() => {
      if (room.state === 'playing') forceEndRound(io, code);
    }, room.options.timeout * 1000);
  }
}

async function startNextRound(io, code) {
  return beginRound(io, code, { consumesRoundSlot: true });
}

function handleSkipVote(io, socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  const result = room.voteSkip(socketId);
  if (!result) return null;

  io.to(code).emit('skip-vote-update', {
    count: result.count, required: result.required,
    exhausted: result.exhausted, skipsUsed: result.skipsUsed, maxSkips: result.maxSkips,
    voters: result.voters,
  });

  if (result.reached) {
    if (room.endTimer) clearTimeout(room.endTimer);
    room.state = 'round-over';
    io.to(code).emit('round-skipped', { roundNum: room.roundNum, maxRounds: room.maxRounds });

    setTimeout(() => beginRound(io, code, { consumesRoundSlot: false }), 2000);
  }

  return result;
}

function forceEndRound(io, code) {
  const room = rooms.get(code);
  if (!room) return;
  for (const player of room.activePlayers()) {
    if (!player.finished) {
      player.finished   = true;
      player.finishTime = Date.now();
      player.score      = 0;
      io.to(code).emit('player-moved', {
        socketId: player.socketId, username: player.username,
        clicks: player.clicks, finished: true, score: 0,
      });
    }
  }
  finishCurrentRound(io, code);
}

function advanceAfterRoundOver(io, code, matchOver) {
  const room = rooms.get(code);
  if (!room || !rooms.has(code)) return;
  if (room.continueTimer) { clearTimeout(room.continueTimer); room.continueTimer = null; }
  try {
    if (matchOver) {
      room.state = 'results';
      io.to(code).emit('game-over', applyEloIfEligible(room, room.getResults()));
    } else {
      startNextRound(io, code);
    }
  } catch (err) {
    log.error('[finishCurrentRound] unhandled error advancing room:', err);
    io.to(code).emit('room-error', { error: 'Something went wrong, please rejoin' });
  }
}

function finishCurrentRound(io, code, forfeit = null) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.endTimer) clearTimeout(room.endTimer);

  const { matchOver, eliminatedThisRound } = room.finishRound(forfeit);
  const lastRound = room.roundHistory[room.roundHistory.length - 1];

  room.state = 'round-over';
  room.continueVotes.clear();
  room.pendingMatchOver = matchOver;
  io.to(code).emit('round-over', {
    round:      lastRound,
    standings:  room.getStandings(),
    mode:       room.options.mode,
    roundNum:   room.roundNum,
    maxRounds:  room.maxRounds,
    eliminatedThisRound,
    matchOver,
  });

  room.continueTimer = setTimeout(() => advanceAfterRoundOver(io, code, matchOver), 20000);
}

function handleContinueVote(io, socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  const result = room.voteContinue(socketId);
  if (!result) return null;

  io.to(code).emit('continue-update', result);
  if (result.reached) {
    advanceAfterRoundOver(io, code, room.pendingMatchOver ?? false);
  }
  return result;
}

function handleClick(io, socketId, toArticle) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  const result = room.handleLinkClick(socketId, toArticle);
  if (!result) return null;

  const player = room.players.get(socketId);
  io.to(code).emit('player-moved', {
    socketId,
    username:       player.username,
    currentArticle: result.currentArticle,
    clicks:         result.clicks,
    finished:       result.finished,
    score:          result.score,
  });

  if (result.finished) {
    io.to(code).emit('player-finished', {
      username: player.username,
      clicks:   result.clicks,
      score:    result.score,
    });

    const finishedCount = room.activePlayers().filter(p => p.finished).length;
    if (finishedCount === 1 && !room.allFinished()) {
      if (room.endTimer) clearTimeout(room.endTimer);
      const sprintMs = room.options.sprintSeconds * 1000;
      const expiresAt = Date.now() + sprintMs;
      room.sprintExpiresAt = expiresAt;
      io.to(code).emit('sprint-started', { expiresAt });
      room.endTimer = setTimeout(() => {
        if (room.state === 'playing') forceEndRound(io, code);
      }, sprintMs);
    }
  }

  if (room.allFinished()) {
    finishCurrentRound(io, code);
  }

  return result;
}

function handleNavMove(io, socketId, toArticle) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  const result = room.handleNavMove(socketId, toArticle);
  if (!result) return null;

  const player = room.players.get(socketId);
  io.to(code).emit('player-moved', {
    socketId,
    username:       player.username,
    currentArticle: result.currentArticle,
    clicks:         result.clicks,
    finished:       false,
    score:          player.score,
  });

  return result;
}

function getRoomBySocket(socketId) {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : null;
}

function getRoom(code) {
  return rooms.get(code ? code.toUpperCase() : '');
}

function kickPlayer(io, hostSocketId, targetSocketId) {
  const code = socketToRoom.get(hostSocketId);
  if (!code) return { error: 'Room not found' };
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostSocketId !== hostSocketId) return { error: 'Only the host can remove players' };
  if (room.state !== 'lobby') return { error: 'Can only remove players before the match starts' };
  if (targetSocketId === hostSocketId) return { error: 'Cannot remove yourself' };
  if (!room.players.has(targetSocketId)) return { error: 'Player not found' };

  room.removePlayer(targetSocketId);
  socketToRoom.delete(targetSocketId);

  const targetSocket = io.sockets.sockets.get(targetSocketId);
  if (targetSocket) {
    targetSocket.emit('kicked');
    targetSocket.leave(code);
  }
  io.to(code).emit('room-updated', room.getPublicState());
  return { ok: true };
}

function handleToggleReady(io, socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  const ready = room.toggleReady(socketId);
  if (ready === null) return null;
  io.to(code).emit('room-updated', room.getPublicState());
  if (room.options.matchmaking && room.players.size >= 2 && Array.from(room.players.values()).every(p => p.ready)) {
    startMatchmakingRoom(io, code);
  }
  return { ready };
}

function rematch(io, code, socketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostSocketId !== socketId) return { error: 'Only the host can rematch' };
  if (room.options.ranked) return { error: 'Ranked matches cannot be rematched' };
  room.resetForRematch();
  io.to(code).emit('room-updated', room.getPublicState());
  return { ok: true };
}

module.exports = {
  rematch,
  createRoom,
  joinRoom,
  leaveRoom,
  handleDisconnect,
  attemptReconnect,
  startGame,
  handleClick,
  handleNavMove,
  handleSkipVote,
  handleContinueVote,
  kickPlayer,
  handleToggleReady,
  finishCurrentRound,
  armMatchmakingStartTimer,
  startMatchmakingRoom,
  getRoomBySocket,
  getRoom,
};
