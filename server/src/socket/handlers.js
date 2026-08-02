const gm = require('../game/GameManager');
const { isValidLink } = require('../game/validator');
const { saveGameHistory, getUserElo } = require('../db');
const { resolveSocketUser, verifyProUser } = require('../lib/socketAuth');
const log = require('../lib/logger');
const { sanitizeDefaultRoomOptions, sanitizeCustomRoomOptions } = require('./roomOptions');

const matchQueue  = [];
const rankedQueue = [];

async function requirePro(socket, token) {
  if (socket.user?.isPro) return true;
  try {
    const user = await verifyProUser(token);
    if (!user) return false;
    socket.user = user;
    return true;
  } catch (err) {
    log.debug('[auth] custom lobby verification failed:', err.message);
    return false;
  }
}

function setupSocketHandlers(io) {
  io.use(async (socket, next) => {
    socket.user = await resolveSocketUser(socket.handshake.auth);
    next();
  });

  io.on('connection', (socket) => {

    socket.on('create-room', (payload = {}, cb) => {
      const { token, ranked, ...options } = payload;
      const sanitized = sanitizeDefaultRoomOptions(options);
      if (sanitized.error) return cb?.({ ok: false, error: sanitized.error });

      const room = gm.createRoom(socket.id, socket.user, sanitized.options);
      socket.join(room.code);
      cb?.({ ok: true, state: room.getPublicState() });
    });

    socket.on('create-custom-room', async ({ token, ...options } = {}, cb) => {
      const verifiedPro = await requirePro(socket, token);
      if (!verifiedPro) return cb?.({ ok: false, error: 'Pro subscription required for Custom Lobby' });

      const room = gm.createRoom(socket.id, socket.user, sanitizeCustomRoomOptions(options));
      socket.join(room.code);
      cb?.({ ok: true, state: room.getPublicState() });
    });

    socket.on('join-room', ({ code }, cb) => {
      try {
        const requestedCode = code?.toUpperCase?.();
        if (!requestedCode) return cb?.({ ok: false, error: 'Room not found' });

        const reconnected = gm.attemptReconnect(io, socket, requestedCode);
        if (reconnected?.room) {
          return cb?.({ ok: true, state: reconnected.room.getPublicState() });
        }

        const already = gm.getRoomBySocket(socket.id);
        if (already && already.code === requestedCode) {
          return cb?.({ ok: true, state: already.getPublicState() });
        }

        const existingRoom = gm.getRoom(requestedCode);
        if (existingRoom?.options?.matchmaking) {
          return cb?.({ ok: false, error: 'This match is private.' });
        }
        if (existingRoom?.options?.isCustom && !socket.user.userId) {
          return cb?.({ ok: false, error: 'ACCOUNT_REQUIRED', message: 'Sign in free to join a custom lobby' });
        }
        const result = gm.joinRoom(requestedCode, socket.id, socket.user);
        if (result.error) return cb?.({ ok: false, error: result.error });
        socket.join(requestedCode);
        io.to(requestedCode).emit('room-updated', result.room.getPublicState());
        cb?.({ ok: true, state: result.room.getPublicState() });
      } catch (err) {
        log.error('[join-room] unhandled error:', err);
        cb?.({ ok: false, error: 'Something went wrong, try again' });
      }
    });

    socket.on('start-game', async ({ code }, cb) => {
      const result = await gm.startGame(io, code, socket.id);
      if (result.error) return cb?.({ ok: false, error: result.error });
      cb?.({ ok: true });
    });

    socket.on('kick-player', ({ targetSocketId }, cb) => {
      const result = gm.kickPlayer(io, socket.id, targetSocketId);
      if (result.error) return cb?.({ ok: false, error: result.error });
      cb?.({ ok: true });
    });

    socket.on('toggle-ready', (cb) => {
      const result = gm.handleToggleReady(io, socket.id);
      if (!result) return cb?.({ ok: false });
      cb?.({ ok: true, ready: result.ready });
    });

    socket.on('find-match', (opts, cb) => {
      const existing = matchQueue.findIndex(p => p.socketId === socket.id);
      if (existing !== -1) matchQueue.splice(existing, 1);

      matchQueue.push({ socketId: socket.id, user: socket.user });

      if (matchQueue.length >= 2) {
        const [p1, p2] = matchQueue.splice(0, 2);
        const room     = gm.createRoom(p1.socketId, p1.user, { difficulty: 'random', matchmaking: true });
        const code     = room.code;

        const s1 = io.sockets.sockets.get(p1.socketId);
        const s2 = io.sockets.sockets.get(p2.socketId);
        if (s1) s1.join(code);
        if (s2) {
          gm.joinRoom(code, p2.socketId, p2.user);
          s2.join(code);
        }

        io.to(code).emit('match-found', { code, state: room.getPublicState() });
        gm.armMatchmakingStartTimer(io, code);
        cb?.({ ok: true, searching: false });
      } else {
        cb?.({ ok: true, searching: true });
      }
    });

    socket.on('find-ranked-match', (opts, cb) => {
      if (!socket.user.userId) {
        return cb?.({ ok: false, error: 'Sign in to play Ranked' });
      }

      const existing = rankedQueue.findIndex(p => p.socketId === socket.id);
      if (existing !== -1) rankedQueue.splice(existing, 1);

      const myElo = getUserElo(socket.user.userId).elo;
      rankedQueue.push({ socketId: socket.id, user: socket.user, elo: myElo });

      if (rankedQueue.length >= 2) {

        const me = rankedQueue[rankedQueue.length - 1];
        let bestIdx = -1, bestDiff = Infinity;
        for (let i = 0; i < rankedQueue.length - 1; i++) {
          const diff = Math.abs(rankedQueue[i].elo - me.elo);
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
        }
        const opponent = rankedQueue[bestIdx];
        rankedQueue.splice(rankedQueue.length - 1, 1);
        rankedQueue.splice(bestIdx, 1);

        const room = gm.createRoom(opponent.socketId, opponent.user, { difficulty: 'random', ranked: true, matchmaking: true });
        const code = room.code;

        const s1 = io.sockets.sockets.get(opponent.socketId);
        const s2 = io.sockets.sockets.get(me.socketId);
        if (s1) s1.join(code);
        if (s2) {
          gm.joinRoom(code, me.socketId, me.user);
          s2.join(code);
        }

        io.to(code).emit('match-found', { code, state: room.getPublicState() });
        gm.armMatchmakingStartTimer(io, code);
        cb?.({ ok: true, searching: false });
      } else {
        cb?.({ ok: true, searching: true });
      }
    });

    socket.on('cancel-match', () => {
      const idx = matchQueue.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) matchQueue.splice(idx, 1);
      const rIdx = rankedQueue.findIndex(p => p.socketId === socket.id);
      if (rIdx !== -1) rankedQueue.splice(rIdx, 1);
    });

    socket.on('click-link', async ({ to }, cb) => {
      try {
        const room = gm.getRoomBySocket(socket.id);
        if (!room || room.state !== 'playing') return cb?.({ ok: false });

        const player = room.players.get(socket.id);
        if (!player || player.finished || player.eliminated) return cb?.({ ok: false });

        const valid = await isValidLink(player.currentArticle, to);
        if (!valid) {
          socket.emit('link-invalid', { from: player.currentArticle, to });
          return cb?.({ ok: false, error: 'Invalid link' });
        }

        const result = gm.handleClick(io, socket.id, to);
        cb?.({ ok: true, result });
      } catch (err) {
        log.error('[click-link] unhandled error:', err);
        cb?.({ ok: false, error: 'Something went wrong, try again' });
      }
    });

    socket.on('nav-move', ({ to }, cb) => {
      try {
        const result = gm.handleNavMove(io, socket.id, to);
        if (!result) return cb?.({ ok: false });
        cb?.({ ok: true, result });
      } catch (err) {
        log.error('[nav-move] unhandled error:', err);
        cb?.({ ok: false, error: 'Something went wrong, try again' });
      }
    });

    socket.on('vote-skip', (cb) => {
      const result = gm.handleSkipVote(io, socket.id);
      cb?.({ ok: !!result });
    });

    socket.on('continue-round', (cb) => {
      try {
        const result = gm.handleContinueVote(io, socket.id);
        cb?.({ ok: !!result });
      } catch (err) {
        log.error('[continue-round] unhandled error:', err);
        cb?.({ ok: false });
      }
    });

    socket.on('give-up', () => {
      const room = gm.getRoomBySocket(socket.id);
      if (!room || room.state !== 'playing') return;
      const player = room.players.get(socket.id);
      if (!player || player.finished || player.eliminated) return;

      player.finished   = true;
      player.finishTime = Date.now();
      player.score      = 0;
      player.gaveUp     = true;

      io.to(room.code).emit('player-moved', {
        socketId: socket.id,
        username: player.username,
        clicks:   player.clicks,
        finished: true,
        score:    0,
        gaveUp:   true,
      });

      const stillPlaying = room.activePlayers().filter(p => !p.finished);
      if (room.options.mode !== 'speedrun' && stillPlaying.length === 1) {
        gm.finishCurrentRound(io, room.code, { winnerSocketId: stillPlaying[0].socketId, loserSocketId: socket.id });
      } else if (room.allFinished()) {
        gm.finishCurrentRound(io, room.code);
      }
    });

    socket.on('chat-message', ({ text }) => {
      const room = gm.getRoomBySocket(socket.id);
      if (!room) return;

      const clean = String(text || '').trim().slice(0, 200);
      if (!clean) return;

      io.to(room.code).emit('chat-message', {
        socketId: socket.id,
        username: socket.user.username,
        text:     clean,
        at:       Date.now(),
      });
    });

    socket.on('rematch', ({ code }, cb) => {
      const result = gm.rematch(io, code, socket.id);
      cb?.(result);
    });

    socket.on('solo-complete', (data) => {
      if (!socket.user.userId) return;
      saveGameHistory({
        userId:      socket.user.userId,
        pairId:      data.pairId,
        pathTaken:   data.path,
        clicks:      data.clicks,
        timeSeconds: data.timeSeconds,
        completed:   data.completed,
        score:       data.score,
        mode:        'solo',
      });
    });

    socket.on('disconnect', () => {

      const qIdx = matchQueue.findIndex(p => p.socketId === socket.id);
      if (qIdx !== -1) matchQueue.splice(qIdx, 1);
      const rIdx = rankedQueue.findIndex(p => p.socketId === socket.id);
      if (rIdx !== -1) rankedQueue.splice(rIdx, 1);

      const result = gm.handleDisconnect(io, socket.id);
      if (result && !result.roomEmpty && result.room && !result.grace) {
        io.to(result.code).emit('room-updated', result.room.getPublicState());
      }
    });
  });
}

module.exports = { setupSocketHandlers };
