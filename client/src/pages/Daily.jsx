import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useAuth, SignInButton } from '@clerk/clerk-react';
import WikiArticle from '../components/WikiArticle';
import NetworkBackground from '../components/NetworkBackground';
import HintButton from '../components/HintButton';
import ReportButton from '../components/ReportButton';
import ShortestPath from '../components/game/ShortestPath';
import { useMotion } from '../lib/MotionContext';
import { normalizeTitle as nt } from '../lib/format';
import { apiFetch } from '../lib/apiFetch';
import styles from './Daily.module.css';

function msUntilNextUTCMidnight() {
  const now  = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}

function guestProgressKey(dateStr) {
  return `wikiracr_daily_guest_${dateStr}`;
}

function loadGuestProgress(dateStr) {
  try {
    const raw = localStorage.getItem(guestProgressKey(dateStr));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.navHist) || typeof saved.histIdx !== 'number' || typeof saved.clicks !== 'number') return null;
    return saved;
  } catch {
    return null;
  }
}

function saveGuestProgress(dateStr, navHist, histIdx, clicks, elapsedMs) {
  try {
    localStorage.setItem(guestProgressKey(dateStr), JSON.stringify({ navHist, histIdx, clicks, elapsedMs }));
  } catch {
  }
}

function clearGuestProgress(dateStr) {
  try {
    localStorage.removeItem(guestProgressKey(dateStr));
  } catch {
  }
}

const LAUNCH_DATE = '2026-07-05';

function dayNumber(dateStr) {
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = new Date(dateStr + 'T00:00:00Z') - new Date(LAUNCH_DATE + 'T00:00:00Z');
  return Math.max(1, Math.floor(diff / oneDay) + 1);
}

function buildClickGrid(clicks, optClicks) {
  const MAX = 12;
  const extra = Math.max(0, clicks - optClicks);
  const green = Math.min(optClicks, MAX);
  const red   = Math.min(extra, MAX - green);
  const overflow = (optClicks - green) + (extra - red);
  let grid = ('\ud83d\udfe9 '.repeat(green) + '\ud83d\udfe5 '.repeat(red)).trim();
  if (overflow > 0) grid += ` +${overflow}`;
  return grid;
}

function formatShareTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function buildShareText(dateStr, result, streak, optClicks) {
  const lines = [`WikiRacr Daily #${dayNumber(dateStr)}`];
  if (optClicks !== null) lines.push(buildClickGrid(result.clicks, optClicks));
  const timePart = result.timeSeconds > 0 ? ` \u00b7 ${formatShareTime(result.timeSeconds)}` : '';
  lines.push(`${result.clicks} click${result.clicks !== 1 ? 's' : ''}${optClicks !== null ? ` (optimal: ${optClicks})` : ''}${timePart}`);
  if (streak > 0) lines.push(`\ud83d\udd25 ${streak} day streak`);
  lines.push('https://wikiracr.com/daily');
  return lines.join('\n');
}

export default function Daily() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { getToken }        = useAuth();
  const { enabled: motion } = useMotion();

  const [phase, setPhase]         = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [date, setDate]           = useState(null);
  const [pair, setPair]           = useState(null);
  const [navHist, setNavHist]     = useState([]);
  const [histIdx, setHistIdx]     = useState(0);
  const [clicks, setClicks]       = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [result, setResult]       = useState(null);
  const [savedProgress, setSavedProgress] = useState(null);
  const [leaderboard, setLeaderboard]   = useState([]);
  const [submitError, setSubmitError]   = useState(null);
  const [streak, setStreak]             = useState(0);
  const [shareCopied, setShareCopied]   = useState(false);
  const [shareOpen, setShareOpen]       = useState(false);
  const shareBoxRef = useRef(null);
  const elapsedMsRef = useRef(0);
  const activeStartRef = useRef(null);
  const [resetIn, setResetIn]           = useState(msUntilNextUTCMidnight());

  const currentArticle = navHist[histIdx] ?? '';

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) { checkStatusThenLoad(); }
    else { fetchDaily(); }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (phase !== 'playing') return;
    function onVisibilityChange() {
      if (document.hidden) {
        if (activeStartRef.current) {
          elapsedMsRef.current += Date.now() - activeStartRef.current;
          activeStartRef.current = null;
        }
      } else if (!activeStartRef.current) {
        activeStartRef.current = Date.now();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'results') return;
    const id = setInterval(() => setResetIn(msUntilNextUTCMidnight()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!shareOpen) return;
    function onClick(e) {
      if (shareBoxRef.current && !shareBoxRef.current.contains(e.target)) setShareOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [shareOpen]);

  async function checkStatusThenLoad() {
    setPhase('loading');
    setLoadError(null);
    try {
      const token  = await getToken();
      const statusRes = await fetch('/api/daily/status', { headers: { Authorization: `Bearer ${token}` } });
      const status = await statusRes.json();
      setStreak(status.streak || 0);
      setDate(status.date);

      if (status.completed) {
        setResult({ clicks: status.result.clicks, timeSeconds: status.result.timeSeconds || 0 });
        fetchLeaderboard(status.date);
        fetchPairForDisplay();
        setPhase('results');
        return;
      }

      setSavedProgress(status.progress || null);
      fetchDaily();
    } catch {
      fetchDaily();
    }
  }

  function fetchDaily() {
    apiFetch('/api/daily')
      .then(({ date: d, pair: p }) => {
        setDate(d);
        setPair(p);
        if (!isSignedIn) {
          const saved = loadGuestProgress(d);
          if (saved) setSavedProgress(saved);
        }
        setPhase('intro');
      })
      .catch(e => setLoadError(e.message));
  }

  function fetchPairForDisplay() {
    fetch('/api/daily')
      .then(r => r.json())
      .then(({ pair: p }) => { if (p) setPair(p); })
      .catch(() => {});
  }

  function fetchLeaderboard(forDate) {
    fetch(`/api/leaderboard/daily?date=${forDate}`)
      .then(r => r.json())
      .then(({ leaderboard: lb }) => setLeaderboard(lb || []))
      .catch(() => {});
  }

  async function persistProgress(newHist, newIdx, newClicks) {
    const activeMs = activeStartRef.current ? Date.now() - activeStartRef.current : 0;
    const elapsedMs = elapsedMsRef.current + activeMs;

    if (!isSignedIn) {
      saveGuestProgress(date, newHist, newIdx, newClicks, elapsedMs);
      return;
    }
    try {
      const token = await getToken();
      await fetch('/api/daily/progress', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ navHist: newHist, histIdx: newIdx, clicks: newClicks, elapsedMs }),
      });
    } catch {
    }
  }

  function beginCountdown() {
    setCountdown(3);
    setPhase('countdown');
    setTimeout(() => setCountdown(2), 800);
    setTimeout(() => setCountdown(1), 1600);
    setTimeout(() => startGame(), 2400);
  }

  function startGame() {
    setNavHist([pair.startTitle]);
    setHistIdx(0);
    setClicks(0);
    elapsedMsRef.current = 0;
    activeStartRef.current = document.hidden ? null : Date.now();
    setPhase('playing');
  }

  function resumeGame() {
    setNavHist(savedProgress.navHist);
    setHistIdx(savedProgress.histIdx);
    setClicks(savedProgress.clicks);
    elapsedMsRef.current = savedProgress.elapsedMs || 0;
    activeStartRef.current = document.hidden ? null : Date.now();
    setPhase('playing');
  }

  const handleLinkClick = useCallback((toArticle) => {
    if (phase !== 'playing') return;
    const newClicks  = clicks + 1;
    const newHistory = [...navHist.slice(0, histIdx + 1), toArticle];
    const newIdx     = newHistory.length - 1;
    setNavHist(newHistory);
    setHistIdx(newIdx);
    setClicks(newClicks);

    if (toArticle.toLowerCase() === nt(pair.endTitle).toLowerCase()) {
      finish(newClicks, newHistory, newIdx);
    } else {
      persistProgress(newHistory, newIdx, newClicks);
    }
  }, [phase, clicks, navHist, histIdx, pair]);

  function goBack() {
    if (phase !== 'playing' || histIdx <= 0) return;
    const newIdx = histIdx - 1;
    const newClicks = clicks + 1;
    setHistIdx(newIdx);
    setClicks(newClicks);
    persistProgress(navHist, newIdx, newClicks);
  }

  function goForward() {
    if (phase !== 'playing' || histIdx >= navHist.length - 1) return;
    const newIdx = histIdx + 1;
    const newClicks = clicks + 1;
    setHistIdx(newIdx);
    setClicks(newClicks);
    persistProgress(navHist, newIdx, newClicks);
  }

  async function finish(finalClicks, finalHistory, finalIdx) {
    const activeMs = activeStartRef.current ? Date.now() - activeStartRef.current : 0;
    activeStartRef.current = null;
    const timeSeconds = Math.max(0, Math.round((elapsedMsRef.current + activeMs) / 1000));
    setResult({ clicks: finalClicks, timeSeconds });
    setSubmitError(null);
    setPhase('results');
    fetchLeaderboard(date);

    if (!isSignedIn) { clearGuestProgress(date); return; }

    try {
      const token    = await getToken();
      const username = user?.username || user?.firstName || 'Player';
      const res = await fetch('/api/leaderboard/daily', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

        body:    JSON.stringify({ username, score: 0, clicks: finalClicks, timeSeconds }),
      });
      const data = await res.json();
      if (res.ok) {
        setStreak(data.streak ?? streak);
      } else if (res.status !== 409) {
        throw new Error(data.error || 'submit failed');
      }
      await fetch('/api/me/game', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          pairId: pair.id, path: finalHistory, clicks: finalClicks,
          timeSeconds, completed: true, score: 0, mode: 'daily',
        }),
      });
      fetchLeaderboard(date);
    } catch {
      setSubmitError('Could not save your result. It still counts on this screen.');
    }
  }

  function copyResult() {
    const optClicks = pair ? (pair.optimalPath?.length || 1) - 1 : null;
    const text = buildShareText(date, result, streak, optClicks);
    navigator.clipboard.writeText(text).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

  function shareTo(platform) {
    const optClicks = pair ? (pair.optimalPath?.length || 1) - 1 : null;
    const text = buildShareText(date, result, streak, optClicks);
    const encoded = encodeURIComponent(text);
    const urls = {
      x:        `https://twitter.com/intent/tweet?text=${encoded}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encoded}`,
      reddit:   `https://www.reddit.com/submit?title=${encodeURIComponent('WikiRacr Daily #' + dayNumber(date))}&text=${encoded}`,
    };
    window.open(urls[platform], '_blank', 'noopener,noreferrer');
    setShareOpen(false);
  }

  if (loadError) {
    return (
      <div className={styles.root}>
        <div className={styles.gateWrap}>
          <div className={styles.headerRow}>
            <Link to="/menu" className={styles.gateBack}>&#8592; Back</Link>
          </div>
          <p className={styles.gateTitle}>Could not load today's challenge</p>
          <p className={styles.gateDesc}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return <div className={styles.root}><div className={styles.spinner} /></div>;
  }

  if (phase === 'intro' && pair) {
    return (
      <div className={styles.root}>
        <NetworkBackground parallax={motion} />
        <div className={styles.introWrap}>
          <div className={styles.headerRow}>
            <p className={styles.tag}>{date}</p>
            <Link to="/menu" className={styles.gateBack}>&#8592; Back</Link>
          </div>
          <h1 className={styles.introTitle}>Today's Challenge</h1>
          <div className={styles.introChips}>
            <span className={`${styles.chip} ${styles.chipStart}`}>{nt(pair.startTitle)}</span>
            <span className={styles.chipArrow}>&#8594;</span>
            <span className={`${styles.chip} ${styles.chipEnd}`}>{nt(pair.endTitle)}</span>
          </div>
          <p className={styles.introSub}>
            {pair.pathLength} click{pair.pathLength !== 1 ? 's' : ''} to shortest path. One attempt today, but you can leave and come back to finish it.
          </p>
          {streak > 0 && <p className={styles.streakTeaser}>&#128293; {streak} day streak. Keep it going.</p>}
          {savedProgress ? (
            <>
              <p className={styles.streakTeaser}>You have a run in progress ({savedProgress.clicks} click{savedProgress.clicks !== 1 ? 's' : ''} so far).</p>
              <button className={styles.startBtn} onClick={resumeGame}>CONTINUE</button>
            </>
          ) : (
            <button className={styles.startBtn} onClick={beginCountdown}>START</button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className={styles.root}>
        <NetworkBackground parallax={motion} />
        <div className={styles.introWrap}>
          <div key={countdown} className={styles.countdown}>{countdown > 0 ? countdown : 'GO'}</div>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && pair) {
    const breadcrumb = navHist.slice(Math.max(0, histIdx - 3), histIdx + 1);
    return (
      <div className={styles.gameroot}>
        <div className={styles.hud}>
          <div className={styles.hudLeft}>
            <button className={styles.navBtn} onClick={goBack}    disabled={histIdx <= 0}>&#8592;</button>
            <button className={styles.navBtn} onClick={goForward} disabled={histIdx >= navHist.length - 1}>&#8594;</button>
            <span className={styles.hudArticle}>{nt(currentArticle)}</span>
          </div>
          <div className={styles.hudCenter}>
            <span className={styles.hudTag}>DAILY</span>
            <span className={styles.hudStartChip}>{nt(pair.startTitle)}</span>
            <span className={styles.hudArrow}>&#8594;</span>
            <span className={styles.hudGoalChip}>{nt(pair.endTitle)}</span>
            <span className={styles.hudOptimal}>{pair.pathLength} optimal</span>
            <HintButton title={pair.endTitle} />
            <ReportButton context={{
              page: 'daily',
              date,
              pairId: pair.id,
              startTitle: pair.startTitle,
              endTitle: pair.endTitle,
              currentArticle,
            }} />
          </div>
          <div className={styles.hudRight}>
            <span className={styles.hudClicks}>{clicks} click{clicks !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className={styles.articleArea}>
          <WikiArticle title={currentArticle} goalTitle={pair.endTitle} onLinkClick={handleLinkClick} />
        </div>

        <div className={styles.bottomBar}>
          <div className={styles.breadcrumb}>
            {breadcrumb.map((a, i) => (
              <span key={i} className={styles.breadcrumbItem}>
                {i > 0 && <span className={styles.breadcrumbArrow}>&rsaquo;</span>}
                <span className={`${styles.breadcrumbChip} ${i === breadcrumb.length - 1 ? styles.breadcrumbChipCurrent : ''}`}>{nt(a)}</span>
              </span>
            ))}
          </div>
          <Link to="/menu" className={styles.menuBtn}>Menu</Link>
        </div>
      </div>
    );
  }

  if (phase === 'results' && result) {
    const optClicks = pair ? (pair.optimalPath?.length || 1) - 1 : null;
    const myName    = user?.username || user?.firstName;
    const myRank    = leaderboard.findIndex(r => r.username === myName);
    const resetHrs  = Math.floor(resetIn / 3_600_000);
    const resetMins = Math.floor((resetIn % 3_600_000) / 60_000);
    const resetSecs = Math.floor((resetIn % 60_000) / 1000);

    return (
      <div className={styles.root}>
        <NetworkBackground parallax={motion} />
        <div className={styles.resWrap}>
          <p className={styles.resLabel}>CHALLENGE COMPLETE</p>

          <div className={styles.clickCompare}>
            <span>{result.clicks} click{result.clicks !== 1 ? 's' : ''}</span>
            {optClicks !== null && <>
              <span className={styles.vsText}>vs</span>
              <span>{optClicks} optimal</span>
            </>}
            {result.timeSeconds > 0 && <span className={styles.vsText}>&middot; {Math.floor(result.timeSeconds / 60)}:{String(result.timeSeconds % 60).padStart(2, '0')}</span>}
          </div>

          {optClicks !== null && <p className={styles.clickGrid}>{buildClickGrid(result.clicks, optClicks)}</p>}

          {navHist.length > 0 && <ShortestPath pathTitles={navHist} label="YOUR ROUTE" />}
          <ShortestPath pathTitles={pair?.optimalPath} />

          {isSignedIn && streak > 0 && <p className={styles.streakTeaser}>&#128293; {streak} day streak</p>}
          {!isSignedIn && (
            <div className={styles.guestNudge}>
              <p className={styles.guestNudgeText}>Sign in to save your streak and get your name on the leaderboard.</p>
              <SignInButton mode="modal" afterSignInUrl="/daily">
                <button className={styles.guestNudgeBtn}>Sign in free</button>
              </SignInButton>
            </div>
          )}

          {submitError && <p className={styles.submitError}>{submitError}</p>}

          <div className={styles.lbBox}>
            <p className={styles.lbTitle}>TODAY'S LEADERBOARD</p>
            {leaderboard.length === 0 && <p className={styles.lbEmpty}>Be the first to post a result today</p>}
            {leaderboard.slice(0, 10).map((r, i) => (
              <div key={i} className={`${styles.lbRow} ${i === myRank ? styles.lbMe : ''}`}>
                <span className={styles.lbRank}>#{i + 1}</span>
                <span className={styles.lbName}>{r.username}</span>
                <span className={styles.lbClicks}>{r.clicks} click{r.clicks !== 1 ? 's' : ''}{r.time_seconds > 0 ? ` \u00b7 ${formatShareTime(r.time_seconds)}` : ''}</span>
              </div>
            ))}
          </div>

          <p className={styles.resetTimer}>Next challenge in {resetHrs}h {resetMins}m {resetSecs}s</p>

          <div className={styles.resButtons}>
            <div className={styles.shareRow}>
              <button className={styles.iconBtn} onClick={copyResult} title="Copy result" aria-label="Copy result">
                {shareCopied ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
              <div className={styles.shareWrap} ref={shareBoxRef}>
                <button className={styles.iconBtn} onClick={() => setShareOpen(o => !o)} title="Share" aria-label="Share">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                </button>
                {shareOpen && (
                  <div className={styles.sharePanel}>
                    <button onClick={() => shareTo('x')}>X</button>
                    <button onClick={() => shareTo('whatsapp')}>WhatsApp</button>
                    <button onClick={() => shareTo('reddit')}>Reddit</button>
                  </div>
                )}
              </div>
            </div>
            <Link to="/menu" className={styles.resSecondary}>MENU</Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
