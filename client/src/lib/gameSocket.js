import { connectSocket } from './socket';

export async function connectMultiplayerRoom({
  user, isPro, getToken, navigate, code, isCancelled = () => false,
  socketRef, startTimeRef,
  setMySocketId, setRoomState, setPlayers, setPhase, setPair,
  setChipReveal, setCountdown, setMpRoundNum, setMpMaxRounds, setStandings,
  setRoundBanner, setSkipCount, setSkipRequired, setSkipVoters, setSkipsExhausted,
  setContinueCount, setContinueRequired, setIHaveContinued,
  setSprintExpiresAt, setEliminatedThisRound, setChatMessages, setResults,
  setPathReveal, setDisplayScore, setLoadError, setJoinError,
  setNavHist, setHistIdx, setClicks, setElapsed,
}) {
  const token = user ? await getToken() : null;
  if (isCancelled()) return;
  const userObj = {
    userId:   user?.id   || null,
    username: user?.username || user?.firstName || 'Guest',
    isPro,
  };
  const socket = connectSocket(userObj, token);
  socketRef.current = socket;

  socket.on('connect', () => setMySocketId(socket.id));

  socket.on('room-updated', state => {
    setRoomState(state);
    setPlayers(state.players);

    setPhase(prev => (state.state === 'lobby' || (prev !== 'playing' && prev !== 'results')) ? 'lobby' : prev);
  });

  socket.on('game-countdown', ({ seconds, pair: p, roundNum: rn, maxRounds: mr, standings: st }) => {
    setPair({ startTitle: p.startTitle, endTitle: p.endTitle, pathLength: p.pathLength });
    setChipReveal(0);
    setCountdown(seconds);
    if (rn) setMpRoundNum(rn);
    if (mr) setMpMaxRounds(mr);
    if (st) setStandings(st);
    setRoundBanner(null);
    setSkipCount(0);
    setSkipRequired(0);
    setSkipVoters([]);
    if (rn === 1) setSkipsExhausted(false);
    setSprintExpiresAt(null);
    setPhase('preround');
  });

  socket.on('game-started', ({ pair: p, startTime, roundNum: rn, maxRounds: mr }) => {
    startTimeRef.current = startTime;
    setNavHist([p.startTitle]);
    setHistIdx(0);
    setClicks(0);
    setElapsed(0);
    if (rn) setMpRoundNum(rn);
    if (mr) setMpMaxRounds(mr);

    setPlayers(prev => prev.map(pl => ({ ...pl, finished: false, clicks: 0, gaveUp: false, disconnected: pl.disconnected })));
    setSprintExpiresAt(null);
    setPhase('playing');
  });

  socket.on('sprint-started', ({ expiresAt }) => {
    setSprintExpiresAt(expiresAt);
  });

  socket.on('round-over', ({ round, standings: st, roundNum: rn, maxRounds: mr, eliminatedThisRound: elim, matchOver }) => {
    setStandings(st);
    if (rn) setMpRoundNum(rn);
    if (mr) setMpMaxRounds(mr);
    setEliminatedThisRound(elim || []);
    setRoundBanner({ ...round, matchOver });
    setContinueCount(0);
    setContinueRequired(0);
    setIHaveContinued(false);
    setPhase('round-over');
  });

  socket.on('skip-vote-update', ({ count, required, exhausted, voters }) => {
    setSkipCount(count);
    setSkipRequired(required);
    if (voters) setSkipVoters(voters);
    if (exhausted) setSkipsExhausted(true);
  });

  socket.on('continue-update', ({ count, required }) => {
    setContinueCount(count);
    setContinueRequired(required);
  });

  socket.on('round-skipped', ({ roundNum: rn, maxRounds: mr }) => {
    if (rn) setMpRoundNum(rn);
    if (mr) setMpMaxRounds(mr);
    setPhase('round-skipped');
  });

  socket.on('player-eliminated', ({ socketId }) => {
    setPlayers(prev => prev.filter(p => p.socketId !== socketId));
    setStandings(prev => prev.map(s => s.socketId === socketId ? { ...s, eliminated: true, disconnected: true } : s));
  });

  socket.on('player-moved', ({ socketId, clicks: c, finished, score, disconnected, graceExpiresAt, gaveUp }) => {
    setPlayers(prev => prev.map(p =>
      p.socketId === socketId
        ? { ...p, clicks: c, finished, score, disconnected: !!disconnected, graceExpiresAt: disconnected ? graceExpiresAt : null, gaveUp: !!gaveUp }
        : p
    ));
  });

  socket.on('game-over', res => {
    setResults(res);
    setPathReveal(0);
    setDisplayScore(0);
    setRoundBanner(null);
    setPhase('results');
  });

  socket.on('room-error', ({ error }) => {
    setLoadError(error || 'Something went wrong');
  });

  socket.on('match-cancelled', ({ message }) => {
    setJoinError(message || 'Match cancelled.');
    setPhase('join-error');
  });

  socket.on('link-invalid', () => {});

  socket.on('chat-message', msg => {
    setChatMessages(prev => [...prev, msg].slice(-100));
  });

  socket.on('match-found', ({ code: matchCode }) => {
    navigate(`/room/${matchCode}`);
  });

  socket.on('kicked', () => {
    setPhase('kicked');
  });

  socket.timeout(10000).emit('join-room', { code }, (err, response) => {
    if (err || !response?.ok) {
      const { error, message } = response || {};
      if (error === 'ACCOUNT_REQUIRED') { setPhase('signin-required'); return; }
      setJoinError(err ? 'Connection timed out, please try again' : (message || error || 'Could not join this room'));
      setPhase('join-error');
      return;
    }
    const { state } = response;
    setRoomState(state);
    setPlayers(state.players);
    if (state.state === 'lobby') {
      setPhase('lobby');
      return;
    }
    if (state.state === 'results') {

      setPhase('lobby');
      return;
    }

    const me = state.players.find(p => p.socketId === socket.id);
    if (state.state === 'playing' && state.pair && me && !me.finished && !me.eliminated) {
      const path = (me.path && me.path.length) ? me.path : [state.pair.startTitle];
      setPair({ startTitle: state.pair.startTitle, endTitle: state.pair.endTitle, pathLength: state.pair.pathLength });
      setNavHist(path);
      setHistIdx(path.length - 1);
      setClicks(me.clicks || 0);
      setElapsed(Math.floor((Date.now() - state.startTime) / 1000));
      startTimeRef.current = state.startTime;
      setPhase('playing');
    } else {

      setPhase('reconnect-wait');
    }
  });
}
