const {
  MODES,
  ROUND_OPTIONS,
  MAX_SKIPS,
  DEFAULT_HP,
} = require('./constants');
const { MAX_SCORE, calcScore, calcKnockoutDamage } = require('./scoring');

class Room {
  constructor(code, hostSocketId, options = {}) {
    this.code         = code;
    this.hostSocketId = hostSocketId;
    this.state        = 'lobby';
    this.pair         = null;
    this.startTime    = null;
    this.endTimer     = null;
    this.createdAt    = Date.now();

    this.roundNum     = 0;
    this.roundHistory = [];
    this.eliminationCounter = 0;
    this.skipVotes    = new Set();
    this.skipsUsed    = 0;
    this.continueVotes = new Set();
    this.continueTimer = null;
    this.pendingMatchOver = false;
    this.sprintExpiresAt = null;
    this.lobbyAutoStartAt = null;

    const mode   = MODES.includes(options.mode) ? options.mode : 'classic';
    const rounds = ROUND_OPTIONS[mode]?.includes(options.rounds) ? options.rounds : 5;

    this.options = {
      mode,
      rounds,
      difficulty:      options.difficulty      || 'random',
      maxPlayers:      Math.min(Math.max(options.maxPlayers || 2, 2), 32),
      timeout:         options.timeout ?? 0,
      sprintSeconds:   Math.min(Math.max(options.sprintSeconds || 60, 10), 300),
      pathLength:      options.pathLength      || null,
      customPair:      options.customPair      || null,
      hp:              options.hp              || DEFAULT_HP,
      immunityPercent: Math.min(Math.max(options.immunityPercent || 20, 5), 50),
      damageRampPercent: Math.min(Math.max(options.damageRampPercent ?? 5, 0), 50),
      ranked:      options.ranked === true,
      isCustom:    options.isCustom === true,
      matchmaking: options.matchmaking === true,
    };

    this.maxRounds = mode === 'knockout' ? null : rounds;

    this.players = new Map();
  }

  addPlayer(socketId, user) {
    if (this.players.size >= this.options.maxPlayers) return false;
    if (this.state !== 'lobby') return false;
    this.players.set(socketId, {
      socketId,
      userId:    user.userId   || null,
      username:  user.username || 'Guest',
      isPro:     user.isPro    || false,
      currentArticle:   null,
      path:             [],
      clicks:           0,
      finished:         false,
      finishTime:       null,
      score:            0,
      roundWins:        0,
      totalScore:       0,
      totalClicks:      0,
      totalTimeSeconds: 0,
      hp:               this.options.hp,
      lastDamage:       0,
      lastDamageFormula: null,
      eliminated:       false,
      eliminationOrder: null,
      disconnected:     false,
      ready:            false,
      gaveUp:           false,
    });
    return true;
  }

  toggleReady(socketId) {
    const player = this.players.get(socketId);
    if (!player || this.state !== 'lobby') return null;
    player.ready = !player.ready;
    return player.ready;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (socketId === this.hostSocketId && this.players.size > 0) {
      this.hostSocketId = this.players.keys().next().value;
    }
  }

  findDisconnectedByUserId(userId) {
    if (!userId) return null;
    for (const [socketId, player] of this.players) {
      if (player.disconnected && !player.eliminated && player.userId === userId) return { socketId, player };
    }
    return null;
  }

  reattachPlayer(oldSocketId, newSocketId) {
    const player = this.players.get(oldSocketId);
    if (!player) return null;
    this.players.delete(oldSocketId);
    player.socketId   = newSocketId;
    player.disconnected = false;
    this.players.set(newSocketId, player);
    if (this.hostSocketId === oldSocketId) this.hostSocketId = newSocketId;
    return player;
  }

  startMatch() {
    this.roundNum     = 0;
    this.roundHistory = [];
    this.eliminationCounter = 0;
    this.skipsUsed    = 0;
    for (const player of this.players.values()) {
      player.roundWins        = 0;
      player.totalScore       = 0;
      player.totalClicks      = 0;
      player.totalTimeSeconds = 0;
      player.hp               = this.options.hp;
      player.lastDamage       = 0;
      player.lastDamageFormula = null;
      player.eliminated       = false;
      player.eliminationOrder = null;
      player.disconnected     = false;
    }
  }

  recordElimination(player) {
    player.eliminated       = true;
    player.eliminationOrder = ++this.eliminationCounter;
  }

  activePlayers() {
    return Array.from(this.players.values()).filter(p => !p.eliminated && !p.disconnected);
  }

  _resetRoundState(pair) {
    this.pair      = pair;
    this.state     = 'playing';
    this.startTime = Date.now();
    this.skipVotes.clear();
    this.sprintExpiresAt = null;
    for (const player of this.activePlayers()) {
      player.currentArticle = pair.start_title;
      player.path           = [pair.start_title];
      player.clicks         = 0;
      player.finished       = false;
      player.gaveUp         = false;
      player.finishTime     = null;
      player.score          = 0;
      player.lastDamage     = 0;
      player.lastDamageFormula = null;
    }
  }

  startRound(pair) {
    this.roundNum += 1;
    this._resetRoundState(pair);
  }

  restartRoundAfterSkip(pair) {
    this._resetRoundState(pair);
  }

  voteSkip(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.eliminated || player.disconnected || this.state !== 'playing') return null;
    if (this.skipsUsed >= MAX_SKIPS) {
      return { count: this.skipVotes.size, required: 0, reached: false, exhausted: true, skipsUsed: this.skipsUsed, maxSkips: MAX_SKIPS, voters: Array.from(this.skipVotes) };
    }
    this.skipVotes.add(socketId);
    const active   = this.activePlayers().length;
    const required = Math.floor(active / 2) + 1;
    const reached  = this.skipVotes.size >= required;
    if (reached) this.skipsUsed += 1;
    return { count: this.skipVotes.size, required, reached, exhausted: false, skipsUsed: this.skipsUsed, maxSkips: MAX_SKIPS, voters: Array.from(this.skipVotes) };
  }

  voteContinue(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.eliminated || player.disconnected || this.state !== 'round-over') return null;
    this.continueVotes.add(socketId);
    const required = this.activePlayers().length;
    const reached   = this.continueVotes.size >= required;
    return { count: this.continueVotes.size, required, reached };
  }

  handleNavMove(socketId, toArticle) {
    const player = this.players.get(socketId);
    if (!player || player.eliminated || player.finished || this.state !== 'playing') return null;
    if (!player.path.includes(toArticle)) return null;

    player.currentArticle = toArticle;
    player.clicks++;

    return { currentArticle: player.currentArticle, clicks: player.clicks };
  }

  handleLinkClick(socketId, toArticle) {
    const player = this.players.get(socketId);
    if (!player || player.eliminated || player.finished || this.state !== 'playing') return null;

    player.currentArticle = toArticle;
    player.path.push(toArticle);
    player.clicks++;

    const reached = toArticle.toLowerCase() === this.pair.end_title.replace(/_/g, ' ').toLowerCase();
    if (reached) {
      player.finished    = true;
      player.finishTime  = Date.now();
      if (['classic', 'score', 'knockout'].includes(this.options.mode)) {
        const elapsed       = Math.floor((player.finishTime - this.startTime) / 1000);
        const optimalClicks = JSON.parse(this.pair.optimal_path).length - 1;
        player.score = calcScore(player.clicks, optimalClicks, elapsed);
      }
    }

    return {
      finished:       reached,
      score:          player.score,
      currentArticle: player.currentArticle,
      clicks:         player.clicks,
    };
  }

  allFinished() {
    for (const p of this.activePlayers()) {
      if (!p.finished) return false;
    }
    return true;
  }

  finishRound(forfeit = null) {
    const optimalPath   = JSON.parse(this.pair.optimal_path);
    const optimalClicks = optimalPath.length - 1;
    const active        = this.activePlayers();
    const timeoutSecs   = this.options.timeout || 300;

    const elapsedFor = p => p.finishTime
      ? Math.floor((p.finishTime - this.startTime) / 1000)
      : timeoutSecs;

    let winnerSocketId = null;
    let eliminatedThisRound = [];

    const topScore = Math.max(0, ...active.map(p => p.score));
    const topScorers = topScore > 0 ? active.filter(p => p.score === topScore) : [];

    if (forfeit) {
      const winner = this.players.get(forfeit.winnerSocketId);
      const loser  = this.players.get(forfeit.loserSocketId);
      winnerSocketId = forfeit.winnerSocketId;
      if (winner) { winner.finished = true; winner.finishTime = Date.now(); }

      switch (this.options.mode) {
        case 'classic':
          if (winner) winner.roundWins += 1;
          break;
        case 'score':
          if (loser) loser.totalScore += loser.score;
          break;
        case 'clicks':
          if (loser) loser.totalClicks += loser.clicks;
          break;
        case 'speedrun':
          if (loser) loser.totalTimeSeconds += timeoutSecs;
          break;
        case 'knockout': {
          if (loser && !loser.eliminated) {
            const ramp = 1 + (this.roundNum - 1) * (this.options.damageRampPercent / 100);
            const gap = MAX_SCORE;
            const cutoffScore = MAX_SCORE;
            const damage = calcKnockoutDamage(gap, cutoffScore, ramp);
            loser.lastDamage = damage;
            loser.lastDamageFormula = { gap, ramp, cutoffScore, maxDamage: 1000, forfeit: true };
            loser.hp = Math.max(0, loser.hp - damage);
            if (loser.hp === 0) { this.recordElimination(loser); eliminatedThisRound.push(loser.socketId); }
          }
          break;
        }
      }
    } else {
    switch (this.options.mode) {
      case 'classic': {
        for (const p of active) p.totalScore += p.score;
        if (topScorers.length === 1) {
          topScorers[0].roundWins += 1;
          winnerSocketId = topScorers[0].socketId;
        }
        break;
      }
      case 'score': {
        for (const p of active) p.totalScore += p.score;
        if (topScorers.length === 1) winnerSocketId = topScorers[0].socketId;
        break;
      }
      case 'clicks': {
        for (const p of active) p.totalClicks += p.clicks;
        const fewest = Math.min(...active.map(p => p.clicks));
        const leaders = active.filter(p => p.clicks === fewest);
        if (leaders.length === 1) winnerSocketId = leaders[0].socketId;
        break;
      }
      case 'speedrun': {
        for (const p of active) p.totalTimeSeconds += elapsedFor(p);
        const fastest = Math.min(...active.map(elapsedFor));
        const leaders = active.filter(p => elapsedFor(p) === fastest);
        if (leaders.length === 1) winnerSocketId = leaders[0].socketId;
        break;
      }
      case 'knockout': {
        if (topScorers.length === 1) winnerSocketId = topScorers[0].socketId;

        const sorted      = [...active].sort((a, b) => b.score - a.score);
        const safeCount   = Math.max(1, Math.round(sorted.length * (this.options.immunityPercent / 100)));
        const safeIds     = new Set(sorted.slice(0, safeCount).map(p => p.socketId));
        const cutoffScore = sorted[safeCount - 1].score;

        for (const p of active) {
          if (safeIds.has(p.socketId)) continue;
          const gap = Math.max(0, cutoffScore - p.score);
          const ramp = 1 + (this.roundNum - 1) * (this.options.damageRampPercent / 100);
          const damage = calcKnockoutDamage(gap, cutoffScore, ramp);
          p.lastDamage = damage;
          p.lastDamageFormula = { gap, ramp, cutoffScore, maxDamage: 1000 };
          p.hp = Math.max(0, p.hp - damage);
          if (p.hp === 0) { this.recordElimination(p); eliminatedThisRound.push(p.socketId); }
        }
        break;
      }
    }
    }

    this.roundHistory.push({
      roundNum: this.roundNum,
      pair:     { startTitle: this.pair.start_title, endTitle: this.pair.end_title, optimalClicks, optimalPath },
      results:  active.map(p => ({
        socketId: p.socketId, username: p.username,
        clicks: p.clicks, score: p.score, finished: p.finished, gaveUp: p.gaveUp,
        hp: p.hp, lastDamage: p.lastDamage, lastDamageFormula: p.lastDamageFormula, eliminated: p.eliminated,
      })),
      winnerSocketId,
      eliminatedThisRound,
    });

    const remaining = this.activePlayers().length;
    let matchOver;
    if (this.options.mode === 'classic') {
      const majority = Math.floor(this.options.rounds / 2) + 1;
      matchOver = Array.from(this.players.values()).some(p => p.roundWins >= majority) || this.roundNum >= this.options.rounds;
    } else if (this.options.mode === 'knockout') {
      matchOver = remaining <= 1;
    } else {
      matchOver = this.roundNum >= this.options.rounds;
    }

    return { matchOver, eliminatedThisRound };
  }

  resetForRematch() {
    this.state        = 'lobby';
    this.pair         = null;
    this.startTime    = null;
    this.roundNum     = 0;
    this.roundHistory = [];
    this.eliminationCounter = 0;
    if (this.endTimer) clearTimeout(this.endTimer);
    for (const player of this.players.values()) {
      player.currentArticle   = null;
      player.path             = [];
      player.clicks           = 0;
      player.finished         = false;
      player.finishTime       = null;
      player.score            = 0;
      player.roundWins        = 0;
      player.totalScore       = 0;
      player.totalClicks      = 0;
      player.totalTimeSeconds = 0;
      player.hp               = this.options.hp;
      player.lastDamage       = 0;
      player.lastDamageFormula = null;
      player.eliminated       = false;
      player.eliminationOrder = null;
      player.ready            = false;
      player.gaveUp           = false;
      player.disconnected     = false;
    }
  }

  getPublicState() {
    return {
      code:         this.code,
      state:        this.state,
      options:      this.options,
      hostSocketId: this.hostSocketId,
      maxRounds:    this.maxRounds,
      lobbyAutoStartAt: this.lobbyAutoStartAt,
      roundNum:     this.roundNum,
      players: Array.from(this.players.values()).map(p => ({
        socketId:       p.socketId,
        username:       p.username,
        currentArticle: p.currentArticle,
        path:           p.path,
        clicks:         p.clicks,
        finished:       p.finished,
        score:          p.score,
        roundWins:      p.roundWins,
        totalScore:     p.totalScore,
        totalClicks:    p.totalClicks,
        totalTimeSeconds: p.totalTimeSeconds,
        hp:             p.hp,
        lastDamage:     p.lastDamage,
        lastDamageFormula: p.lastDamageFormula,
        eliminated:     p.eliminated,
        disconnected:   p.disconnected,
        ready:          p.ready,
        gaveUp:         p.gaveUp,
      })),
      pair: this.pair ? {
        startTitle: this.pair.start_title,
        endTitle:   this.pair.end_title,
        pathLength: this.pair.path_length,
      } : null,
      startTime: this.startTime,
    };
  }

  compareFn() {
    const activeFirst = (a, b) => {
      const aOut = a.eliminated || a.disconnected;
      const bOut = b.eliminated || b.disconnected;
      if (aOut !== bOut) return aOut ? 1 : -1;
      return 0;
    };

    const byMode = {
      classic:  (a, b) => b.roundWins - a.roundWins || b.totalScore - a.totalScore,
      score:    (a, b) => b.totalScore - a.totalScore,
      clicks:   (a, b) => a.totalClicks - b.totalClicks || a.totalTimeSeconds - b.totalTimeSeconds,
      speedrun: (a, b) => a.totalTimeSeconds - b.totalTimeSeconds || a.totalClicks - b.totalClicks,
      knockout: (a, b) => {
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        if (a.eliminated) return (b.eliminationOrder ?? 0) - (a.eliminationOrder ?? 0);
        return b.hp - a.hp || b.totalScore - a.totalScore;
      },
    }[this.options.mode];

    return (a, b) => activeFirst(a, b) || byMode(a, b);
  }

  getStandings() {
    const arr = Array.from(this.players.values()).map(p => ({
      socketId:    p.socketId,
      username:    p.username,
      roundWins:   p.roundWins,
      totalScore:  p.totalScore,
      totalClicks: p.totalClicks,
      totalTimeSeconds: p.totalTimeSeconds,
      hp:          p.hp,
      lastDamage:  p.lastDamage,
      lastDamageFormula: p.lastDamageFormula,
      eliminated:  p.eliminated,
      eliminationOrder: p.eliminationOrder,
      disconnected: p.disconnected,
    }));
    arr.sort(this.compareFn());
    return arr;
  }

  getResults() {
    const optimalPath = JSON.parse(this.pair.optimal_path);
    const mode = this.options.mode;

    const players = Array.from(this.players.values()).map(p => ({
      socketId:    p.socketId,
      username:    p.username,
      userId:      p.userId,
      path:        p.path,
      clicks:      p.clicks,
      finished:    p.finished,
      finishTime:  p.finishTime,
      score:       p.score,
      roundWins:   p.roundWins,
      totalScore:  p.totalScore,
      totalClicks: p.totalClicks,
      totalTimeSeconds: p.totalTimeSeconds,
      hp:          p.hp,
      lastDamage:  p.lastDamage,
      lastDamageFormula: p.lastDamageFormula,
      eliminated:  p.eliminated,
      eliminationOrder: p.eliminationOrder,
      gaveUp:      p.gaveUp,
      disconnected: p.disconnected,
    }));

    players.sort(this.compareFn());

    return {
      mode,
      pair: {
        startTitle:    this.pair.start_title,
        endTitle:      this.pair.end_title,
        optimalPath,
        optimalClicks: optimalPath.length - 1,
      },
      players,
      roundHistory:   this.roundHistory,
      maxRounds:      this.maxRounds,
      rounds:         this.options.rounds,
      winnerSocketId: players[0]?.socketId ?? null,
    };
  }
}

module.exports = Room;
