import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { fetchPairFromServer } from '../lib/pairApi';
import { connectMultiplayerRoom } from '../lib/gameSocket';
import RoundSkippedScreen from '../components/game/RoundSkippedScreen';
import RoundOverScreen from '../components/game/RoundOverScreen';
import MultiplayerResultsScreen from '../components/game/MultiplayerResultsScreen';
import SoloResultsScreen from '../components/game/SoloResultsScreen';
import SpeedrunResultsScreen from '../components/game/SpeedrunResultsScreen';
import LobbyScreen from '../components/game/LobbyScreen';
import PlayingScreen from '../components/game/PlayingScreen';
import PreroundScreen from '../components/game/PreroundScreen';
import { ProRequiredScreen, ErrorScreen, LoadingScreen, SignInRequiredScreen, ReconnectWaitScreen } from '../components/game/StatusScreens';
import { normalizeTitle as nt } from '../lib/format';
import { calcScore } from '../lib/scoring';
import { useIsPro } from '../lib/useIsPro';
import { useMotion } from '../lib/MotionContext';
import { useGamePreferences } from '../lib/GamePreferencesContext';
import styles from './Game.module.css';

const SPEEDRUN_ROUNDS   = 5;
const SPEEDRUN_TIMEOUT  = 900;
export default function Game() {
  const { code }        = useParams();
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { enabled: motion } = useMotion();
  const { muted, chatEnabled, toggleMute, toggleChat } = useGamePreferences();

  const difficulty = searchParams.get('d') || 'random';
  const isSolo     = !code;
  const isSpeedrun = isSolo && searchParams.get('mode') === 'speedrun';
  const isPro      = useIsPro();

  const [phase, setPhase]         = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);
  const [pair, setPair]           = useState(null);
  const [navHist, setNavHist]     = useState([]);
  const [histIdx, setHistIdx]     = useState(0);
  const [clicks, setClicks]       = useState(0);
  const [checkingLink, setCheckingLink] = useState(false);
  const [linkRejected, setLinkRejected] = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [chipReveal, setChipReveal] = useState(0);
  const [results, setResults]     = useState(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [pathReveal, setPathReveal]     = useState(0);

  const [roundNum, setRoundNum]           = useState(1);
  const [speedrunRounds, setSpeedrunRounds] = useState([]);
  const [speedrunBankedSeconds, setSpeedrunBankedSeconds] = useState(0);
  const [speedrunResults, setSpeedrunResults] = useState(null);

  const [mySocketId, setMySocketId] = useState(null);
  const [roomState, setRoomState]   = useState(null);
  const [players, setPlayers]       = useState([]);
  const [now, setNow]               = useState(Date.now());
  const [sprintExpiresAt, setSprintExpiresAt] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [standings, setStandings]   = useState([]);
  const [mpRoundNum, setMpRoundNum] = useState(1);
  const [mpMaxRounds, setMpMaxRounds] = useState(5);
  const [roundBanner, setRoundBanner] = useState(null);
  const [skipCount, setSkipCount]       = useState(0);
  const [skipRequired, setSkipRequired] = useState(0);
  const [continueCount, setContinueCount]       = useState(0);
  const [continueRequired, setContinueRequired] = useState(0);
  const [iHaveContinued, setIHaveContinued]     = useState(false);
  const [skipVoters, setSkipVoters]     = useState([]);
  const [skipsExhausted, setSkipsExhausted] = useState(false);
  const [eliminatedThisRound, setEliminatedThisRound] = useState([]);
  const [copyCodeLabel, setCopyCodeLabel] = useState('Copy code');
  const mpMode = roomState?.options?.mode || 'classic';

  const [settingsOpen, setSettingsOpen] = useState(false);

  function sendChat(text) {
    socketRef.current?.emit('chat-message', { text });
  }

  function copyRoomCode() {
    const value = code || roomState?.code;
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      setCopyCodeLabel('Copied');
      setTimeout(() => setCopyCodeLabel('Copy code'), 1200);
    }).catch(() => setCopyCodeLabel('Copy failed'));
  }

  const startTimeRef = useRef(null);
  const timerRef     = useRef(null);
  const socketRef    = useRef(null);

  const currentArticle = navHist[histIdx] ?? '';
  const socketId       = socketRef.current?.id ?? mySocketId;
  const isHost         = roomState?.hostSocketId === socketId;

  useEffect(() => {
    if (isSolo) {
      fetchPair();
      return () => clearInterval(timerRef.current);
    }

    if (!isLoaded) return;
    let cancelled = false;
    initMultiplayer(() => cancelled);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      socketRef.current?.disconnect();
    };
  }, [isSolo, isLoaded, user, isPro, getToken]);

  function fetchPair(diff = difficulty) {
    setPhase('loading');
    setLoadError(null);
    fetchPairFromServer(diff)
      .then(p => { setPair(p); setPhase('preround'); })
      .catch(e => setLoadError(e.message));
  }

  function fetchNextSpeedrunPair() {
    setPhase('loading');
    setLoadError(null);
    fetchPairFromServer(difficulty)
      .then(p => {
        setPair(p);
        setNavHist([p.startTitle]);
        setHistIdx(0);
        startTimeRef.current = Date.now();
        setPhase('playing');
      })
      .catch(e => setLoadError(e.message));
  }

  async function initMultiplayer(isCancelled = () => false) {
    return connectMultiplayerRoom({
      user, isPro, getToken, navigate, code, isCancelled,
      socketRef, startTimeRef,
      setMySocketId, setRoomState, setPlayers, setPhase, setPair,
      setChipReveal, setCountdown, setMpRoundNum, setMpMaxRounds, setStandings,
      setRoundBanner, setSkipCount, setSkipRequired, setSkipVoters, setSkipsExhausted,
      setContinueCount, setContinueRequired, setIHaveContinued,
      setSprintExpiresAt, setEliminatedThisRound, setChatMessages, setResults,
      setPathReveal, setDisplayScore, setLoadError, setJoinError,
      setNavHist, setHistIdx, setClicks, setElapsed,
    });
  }

  useEffect(() => {
    const anyGrace = players.some(p => p.disconnected && p.graceExpiresAt);
    const lobbyCountdown = phase === 'lobby' && roomState?.options?.matchmaking && roomState?.lobbyAutoStartAt;
    if (!sprintExpiresAt && !anyGrace && !lobbyCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sprintExpiresAt, players, phase, roomState?.lobbyAutoStartAt, roomState?.options?.matchmaking]);

  useEffect(() => {
    if (phase !== 'preround' || !pair || !isSolo) return;
    const hiddenCount = pair.pathLength - 1;
    const totalChips  = 2 + hiddenCount;
    const timers = [];
    for (let i = 0; i <= totalChips; i++) {
      timers.push(setTimeout(() => setChipReveal(i + 1), 300 + i * 500));
    }
    const afterChips = 300 + totalChips * 500 + 400;
    for (let n = 3; n >= 1; n--) {
      timers.push(setTimeout(() => setCountdown(n), afterChips + (3 - n) * 900));
    }
    timers.push(setTimeout(startSoloGame, afterChips + 3 * 900));
    return () => timers.forEach(clearTimeout);
  }, [phase, pair, isSolo]);

  useEffect(() => {
    if (phase !== 'preround' || isSolo || !pair) return;
    const hiddenCount = pair.pathLength - 1;

    setChipReveal(2 + hiddenCount + 1);
    const timers = [];
    timers.push(setTimeout(() => setCountdown(3), 100));
    timers.push(setTimeout(() => setCountdown(2), 1000));
    timers.push(setTimeout(() => setCountdown(1), 2000));
    return () => timers.forEach(clearTimeout);

  }, [phase, pair, isSolo]);

  function startSoloGame() {
    if (!pair) return;
    setNavHist([pair.startTitle]);
    setHistIdx(0);
    setClicks(0);
    setElapsed(0);
    startTimeRef.current = Date.now();
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (isSpeedrun && (speedrunBankedSeconds + secs) >= SPEEDRUN_TIMEOUT) finishSpeedrunEarly();

    }, 500);
    return () => clearInterval(timerRef.current);
  }, [phase, clicks, isSolo, isSpeedrun, speedrunBankedSeconds]);

  const titlesMatch = useCallback((a, b) => nt(a).trim().toLowerCase() === nt(b).trim().toLowerCase(), []);

  const handleLinkClickSolo = useCallback((toArticle) => {
    if (phase !== 'playing') return;
    const newClicks  = clicks + 1;
    const newHistory = [...navHist.slice(0, histIdx + 1), toArticle];
    setNavHist(newHistory);
    setHistIdx(newHistory.length - 1);
    setClicks(newClicks);
    if (titlesMatch(toArticle, pair.endTitle)) {
      if (isSpeedrun) {
        advanceSpeedrunRound(newClicks);
      } else {
        finishSolo(newClicks, false, newHistory);
      }
    }
  }, [phase, clicks, navHist, histIdx, pair, isSpeedrun, speedrunRounds, roundNum, titlesMatch]);

  const handleLinkClickMulti = useCallback((toArticle) => {
    if (phase !== 'playing' || checkingLink) return;
    setCheckingLink(true);
    setLinkRejected(false);
    socketRef.current?.timeout(10000).emit('click-link', { to: toArticle }, (err, response) => {
      setCheckingLink(false);
      const ok = !err && response?.ok;
      if (ok) {
        setNavHist(prev => {
          const newH = [...prev.slice(0, histIdx + 1), toArticle];
          setHistIdx(newH.length - 1);
          return newH;
        });
        setClicks(c => c + 1);
      } else {
        setLinkRejected(true);
        setTimeout(() => setLinkRejected(false), 2500);
      }
    });
  }, [phase, histIdx, checkingLink]);

  const handleLinkClick = isSolo ? handleLinkClickSolo : handleLinkClickMulti;

  function goBackSolo() {
    if (phase !== 'playing' || histIdx <= 0) return;
    setHistIdx(i => i - 1);
    setClicks(c => c + 1);
  }

  function goForwardSolo() {
    if (phase !== 'playing' || histIdx >= navHist.length - 1) return;
    setHistIdx(i => i + 1);
    setClicks(c => c + 1);
  }

  function goBackMulti() {
    if (phase !== 'playing' || histIdx <= 0) return;
    const newIdx = histIdx - 1;
    socketRef.current?.timeout(10000).emit('nav-move', { to: navHist[newIdx] }, (err, response) => {
      if (!err && response?.ok) { setHistIdx(newIdx); setClicks(c => c + 1); }
    });
  }

  function goForwardMulti() {
    if (phase !== 'playing' || histIdx >= navHist.length - 1) return;
    const newIdx = histIdx + 1;
    socketRef.current?.timeout(10000).emit('nav-move', { to: navHist[newIdx] }, (err, response) => {
      if (!err && response?.ok) { setHistIdx(newIdx); setClicks(c => c + 1); }
    });
  }

  const goBack    = isSolo ? goBackSolo    : goBackMulti;
  const goForward = isSolo ? goForwardSolo : goForwardMulti;

  function finishSolo(finalClicks, timedOut, finalHistory = null) {
    clearInterval(timerRef.current);
    const path      = finalHistory || navHist.slice(0, histIdx + 1);
    const secs      = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const optPath   = pair.optimalPath || [];
    const optClicks = optPath.length - 1;
    const score     = timedOut ? 0 : calcScore(finalClicks, optClicks, secs);
    setResults({
      pair: { startTitle: pair.startTitle, endTitle: pair.endTitle, optimalPath: optPath, optimalClicks: optClicks },
      players: [{
        socketId: 'me', username: user?.username || user?.firstName || 'You',
        path, clicks: finalClicks,
        finished: !timedOut, score, finishTime: timedOut ? null : Date.now(),
      }],
      mySocketId: 'me',
      timedOut,
    });
    setPathReveal(0);
    setDisplayScore(0);
    setPhase('results');
    saveSoloHistory(finalClicks, secs, score, timedOut, path);
  }

  async function saveSoloHistory(finalClicks, secs, score, timedOut, path) {
    if (!user) return;
    try {
      const token = await getToken();
      await fetch('/api/me/game', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          pairId: pair.id, path, clicks: finalClicks,
          timeSeconds: secs, completed: !timedOut, score, mode: 'solo',
        }),
      });
    } catch {
    }
  }

  function advanceSpeedrunRound(roundClicks) {
    const roundSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const bankedTotal  = speedrunBankedSeconds + roundSeconds;
    const completedRound = {
      startTitle:    pair.startTitle,
      endTitle:      pair.endTitle,
      clicks:        roundClicks,
      optimalClicks: (pair.optimalPath?.length || 1) - 1,
      roundSeconds,
      optimalPath:   pair.optimalPath || [],
    };
    const updatedRounds = [...speedrunRounds, completedRound];
    setSpeedrunRounds(updatedRounds);
    setSpeedrunBankedSeconds(bankedTotal);

    if (updatedRounds.length >= SPEEDRUN_ROUNDS) {
      clearInterval(timerRef.current);
      setSpeedrunResults({ rounds: updatedRounds, totalSeconds: bankedTotal, timedOut: false });
      setPhase('speedrun-results');
      submitSpeedrunScore(updatedRounds, bankedTotal);
      return;
    }

    setRoundNum(n => n + 1);
    setClicks(0);
    fetchNextSpeedrunPair();
  }

  async function submitSpeedrunScore(rounds, totalSeconds) {
    try {
      const token      = await getToken();
      const username   = user?.username || user?.firstName || 'Player';
      const totalClicks = rounds.reduce((sum, r) => sum + r.clicks, 0);
      await fetch('/api/leaderboard/speedrun', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, difficulty, totalSeconds, clicks: totalClicks }),
      });
    } catch {
    }
  }

  function finishSpeedrunEarly() {
    const roundSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const bankedTotal  = speedrunBankedSeconds + roundSeconds;
    clearInterval(timerRef.current);
    setSpeedrunResults({ rounds: speedrunRounds, totalSeconds: bankedTotal, timedOut: true });
    setPhase('speedrun-results');
  }

  function giveUp() {
    if (phase !== 'playing') return;
    if (isSpeedrun) {
      finishSpeedrunEarly();
    } else if (isSolo) {
      finishSolo(clicks, true);
    } else {
      socketRef.current?.emit('give-up');
    }
  }

  function voteSkip() {
    if (phase !== 'playing' || isSolo || skipVoters.includes(socketId) || skipsExhausted) return;
    if (players.find(p => p.socketId === socketId)?.finished) return;
    socketRef.current?.emit('vote-skip', () => {});
  }

  function continueRound() {
    if (phase !== 'round-over' || iHaveContinued) return;
    setIHaveContinued(true);
    socketRef.current?.emit('continue-round', () => {});
  }

  function hostStartGame() {
    socketRef.current?.emit('start-game', { code }, ({ ok, error }) => {
      if (!ok) setLobbyError(error);
      else setLobbyError(null);
    });
  }

  function kickPlayer(targetSocketId) {
    socketRef.current?.emit('kick-player', { targetSocketId }, ({ ok, error }) => {
      if (!ok) setLobbyError(error || 'Could not remove player');
    });
  }

  function toggleReady() {
    socketRef.current?.emit('toggle-ready', () => {});
  }

  function hostRematch() {
    socketRef.current?.emit('rematch', { code }, ({ ok, error }) => {
      if (!ok) setLobbyError(error || 'Could not start rematch');
    });
  }

  useEffect(() => {
    if (phase !== 'results' || !results) return;
    const myPlayer = results.players.find(p => p.socketId === (isSolo ? 'me' : socketId));
    const targetByMode = {
      classic:  myPlayer?.roundWins ?? 0,
      score:    myPlayer?.totalScore ?? 0,
      clicks:   myPlayer?.totalClicks ?? 0,
      speedrun: myPlayer?.totalTimeSeconds ?? 0,
      knockout: myPlayer?.hp ?? 0,
    };
    const target = isSolo ? (myPlayer?.score || 0) : (targetByMode[results.mode] ?? 0);
    const t0       = Date.now();
    const dur      = 1800;
    let raf;
    const tick = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, results, socketId, isSolo]);

  useEffect(() => {
    if (phase !== 'results' || !results) return;
    const myPlayer = results.players.find(p => p.socketId === (isSolo ? 'me' : socketId));
    const maxLen   = Math.max((myPlayer?.path?.length || 0), (results.pair?.optimalPath?.length || 0)) + 1;
    let n = 0;
    const id = setInterval(() => { n++; setPathReveal(n); if (n >= maxLen) clearInterval(id); }, 260);
    return () => clearInterval(id);
  }, [phase, results, socketId, isSolo]);

  function playAgain() {
    setResults(null); setChipReveal(0); setCountdown(3); setPair(null);
    if (isSpeedrun) {
      setSpeedrunResults(null);
      setSpeedrunRounds([]);
      setRoundNum(1);
    }
    fetchPair();
  }

  if (isSpeedrun && isLoaded && !isPro) {
    return <ProRequiredScreen rounds={SPEEDRUN_ROUNDS} />;
  }

  if (loadError) {
    return <ErrorScreen title="Could not load game" message={loadError} />;
  }

  if (phase === 'loading') {
    return <LoadingScreen isSpeedrun={isSpeedrun} roundNum={roundNum} speedrunRounds={SPEEDRUN_ROUNDS} />;
  }

  if (phase === 'signin-required') {
    return <SignInRequiredScreen code={code} />;
  }

  if (phase === 'reconnect-wait') {
    return <ReconnectWaitScreen />;
  }

  if (phase === 'join-error') {
    return <ErrorScreen title="Can't join this room" message={joinError} />;
  }

  if (phase === 'kicked') {
    return <ErrorScreen title="Removed from lobby" message="The host removed you from this room." />;
  }

  if (phase === 'lobby') {
    return (
      <LobbyScreen
        motion={motion}
        roomState={roomState}
        mode={mpMode}
        players={players}
        socketId={socketId}
        now={now}
        code={code}
        copyRoomCode={copyRoomCode}
        copyCodeLabel={copyCodeLabel}
        isHost={isHost}
        kickPlayer={kickPlayer}
        toggleReady={toggleReady}
        hostStartGame={hostStartGame}
        lobbyError={lobbyError}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        muted={muted}
        toggleMute={toggleMute}
        chatEnabled={chatEnabled}
        toggleChat={toggleChat}
        chatMessages={chatMessages}
        sendChat={sendChat}
      />
    );
  }

  if (phase === 'preround' && pair) {
    return (
      <PreroundScreen
        pair={pair}
        chipReveal={chipReveal}
        countdown={countdown}
        isSpeedrun={isSpeedrun}
        roundNum={roundNum}
        speedrunRounds={SPEEDRUN_ROUNDS}
        motion={motion}
      />
    );
  }

  if (phase === 'playing' && pair) {
    return (
      <PlayingScreen
        pair={pair}
        currentArticle={currentArticle}
        navHist={navHist}
        histIdx={histIdx}
        clicks={clicks}
        elapsed={elapsed}
        difficulty={difficulty}
        isSolo={isSolo}
        isSpeedrun={isSpeedrun}
        speedrunBankedSeconds={speedrunBankedSeconds}
        speedrunRoundNum={roundNum}
        speedrunRoundsTotal={SPEEDRUN_ROUNDS}
        roomState={roomState}
        players={players}
        standings={standings}
        socketId={socketId}
        mpMode={mpMode}
        mpRoundNum={mpRoundNum}
        mpMaxRounds={mpMaxRounds}
        now={now}
        sprintExpiresAt={sprintExpiresAt}
        skipCount={skipCount}
        skipRequired={skipRequired}
        skipVoters={skipVoters}
        skipsExhausted={skipsExhausted}
        chatMessages={chatMessages}
        chatEnabled={chatEnabled}
        settingsOpen={settingsOpen}
        muted={muted}
        goBack={goBack}
        goForward={goForward}
        handleLinkClick={handleLinkClick}
        checkingLink={!isSolo && checkingLink}
        linkRejected={!isSolo && linkRejected}
        voteSkip={voteSkip}
        giveUp={giveUp}
        sendChat={sendChat}
        toggleMute={toggleMute}
        toggleChat={toggleChat}
        openSettings={() => setSettingsOpen(true)}
        closeSettings={() => setSettingsOpen(false)}
      />
    );
  }

  if (phase === 'round-skipped') {
    return (
      <RoundSkippedScreen
        mode={mpMode}
        roundNum={mpRoundNum}
        maxRounds={mpMaxRounds}
        motion={motion}
      />
    );
  }

  if (phase === 'round-over' && roundBanner) {
    return (
      <RoundOverScreen
        mode={mpMode}
        maxRounds={mpMaxRounds}
        roundBanner={roundBanner}
        standings={standings}
        eliminatedThisRound={eliminatedThisRound}
        mySocketId={socketId}
        motion={motion}
        continueCount={continueCount}
        continueRequired={continueRequired}
        iHaveContinued={iHaveContinued}
        onContinue={continueRound}
      />
    );
  }

  if (phase === 'results' && results) {
    const myId      = isSolo ? 'me' : socketId;
    const myPlayer  = results.players.find(p => p.socketId === myId);
    const optPath   = results.pair?.optimalPath || [];
    const optClicks = results.pair?.optimalClicks ?? (optPath.length - 1);
    const timedOut  = isSolo ? results.timedOut : !!myPlayer?.gaveUp;

    if (!isSolo) {
      return (
        <MultiplayerResultsScreen
          results={results}
          myPlayer={myPlayer}
          displayScore={displayScore}
          maxRounds={mpMaxRounds}
          mySocketId={socketId}
          motion={motion}
          isHost={isHost}
          onRematch={hostRematch}
        />
      );
    }

    return (
      <SoloResultsScreen
        results={results}
        myPlayer={myPlayer}
        displayScore={displayScore}
        optPath={optPath}
        optClicks={optClicks}
        timedOut={timedOut}
        pathReveal={pathReveal}
        motion={motion}
        startTime={startTimeRef.current}
        onPlayAgain={playAgain}
      />
    );
  }

  if (phase === 'speedrun-results' && speedrunResults) {
    return (
      <SpeedrunResultsScreen
        results={speedrunResults}
        totalRounds={SPEEDRUN_ROUNDS}
        motion={motion}
        onPlayAgain={playAgain}
      />
    );
  }

  return null;
}
