import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { useIsPro } from '../lib/useIsPro';
import { normalizeTitle as nt } from '../lib/format';
import { apiFetch } from '../lib/apiFetch';
import styles from './HigherOrLower.module.css';


function articleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

function formatViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

async function fetchSnapshot(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      thumbnail: data.thumbnail?.source || null,
      description: data.description || null,
      articleUrl: data.content_urls?.desktop?.page || articleUrl(title),
    };
  } catch {
    return null;
  }
}

export default function HigherOrLower() {
  const isPro       = useIsPro();
  const { isSignedIn, isLoaded } = useUser();
  const { getToken }   = useAuth();
  const { enabled: motion } = useMotion();

  const [phase, setPhase]     = useState('playing');
  const [titleA, setTitleA]   = useState('');
  const [titleB, setTitleB]   = useState('');
  const [viewsA, setViewsA]   = useState(null);
  const [viewsB, setViewsB]   = useState(null);
  const [streak, setStreak]   = useState(0);
  const [best, setBest]       = useState(0);
  const [picked, setPicked]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [snapA, setSnapA]     = useState(null);
  const [snapB, setSnapB]     = useState(null);

  const gameIdRef = useRef(null);

  const loadPair = useCallback(async () => {
    setLoading(true);
    setPhase('playing');
    setPicked(null);
    setLoadError('');
    setViewsA(null);
    setViewsB(null);
    setSnapA(null);
    setSnapB(null);

    try {
      let pair;
      if (gameIdRef.current) {
        pair = await apiFetch(`/api/higherlower/${encodeURIComponent(gameIdRef.current)}/next`, { method: 'POST' });
      } else {
        const token = isSignedIn ? await getToken() : null;
        pair = await apiFetch('/api/higherlower/start', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        gameIdRef.current = pair.gameId;
        setStreak(0);
      }
      setTitleA(pair.titleA);
      setTitleB(pair.titleB);
      fetchSnapshot(pair.titleA).then(setSnapA);
      fetchSnapshot(pair.titleB).then(setSnapB);
    } catch (err) {
      gameIdRef.current = null;
      setLoadError(err.message || 'Could not load article data. Try again.');
    }
    setLoading(false);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isLoaded) loadPair();
  }, [isLoaded]);

  useEffect(() => {
    if (!isPro || !isSignedIn) return;
    getToken().then(token =>
      fetch('/api/higherlower/best', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setBest(prev => Math.max(prev, d.best || 0)))
        .catch(() => {})
    );
  }, [isPro, isSignedIn]);

  async function guess(pick) {
    if (phase !== 'playing' || loading || !gameIdRef.current) return;
    setPicked(pick);
    setPhase('reveal');

    try {
      const result = await apiFetch(`/api/higherlower/${encodeURIComponent(gameIdRef.current)}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick }),
      });
      setViewsA(result.viewsA);
      setViewsB(result.viewsB);
      setStreak(result.streak);
      setBest(prev => Math.max(prev, result.best || 0, result.streak));
      if (result.correct) {
        setTimeout(loadPair, 1800);
      } else {
        gameIdRef.current = null;
        setPhase('gameover');
      }
    } catch (err) {
      setPicked(null);
      setPhase('playing');
      setLoadError(err.message);
    }
  }

  function restart() {
    gameIdRef.current = null;
    loadPair();
  }

  const winner = viewsA !== null && viewsB !== null
    ? (viewsA > viewsB ? 'A' : 'B')
    : null;

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motion} />
      <div className={styles.vignette} />

      <nav className={styles.nav}>
        <Link to="/menu" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
        <span className={styles.modeTag}>Higher or Lower</span>
      <Link to="/pro" className={styles.menuLink}>MENU</Link>
      </nav>

      {!isPro && (
        <div className={styles.proGate}>
          <span>Higher or Lower is a <strong>Pro</strong> feature.</span>
          <Link to="/upgrade" className={styles.proBtn}>Upgrade</Link>
        </div>
      )}

      {isPro && (
        <main className={styles.main}>

          {phase !== 'gameover' && (
            <>
              <div className={styles.prompt}>Which Wikipedia article gets more monthly views?</div>

              <div className={styles.arena}>
                <div
                  className={`${styles.card} ${phase === 'reveal' && picked === 'A' && winner === 'A' ? styles.correct : ''} ${phase === 'reveal' && picked === 'A' && winner !== 'A' ? styles.wrong : ''} ${loading ? styles.skeleton : ''}`}
                  onClick={() => guess('A')}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && phase !== 'reveal' && !loading) { e.preventDefault(); guess('A'); } }}
                  role="button"
                  tabIndex={phase === 'reveal' || loading ? -1 : 0}
                  aria-disabled={phase === 'reveal' || loading}
                >
                  <div className={styles.imageWrap}>
                    {snapA?.thumbnail && <img className={styles.cardImg} src={snapA.thumbnail} alt="" loading="lazy" />}
                    {snapA?.thumbnail && (
                      <a
                        className={styles.imageCredit}
                        href={snapA.articleUrl || articleUrl(titleA)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                      >
                        Image from Wikipedia/Wikimedia
                      </a>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.cardTitle}>{nt(titleA) || '\u00a0'}</span>
                    {snapA?.description && <span className={styles.cardDesc}>{snapA.description}</span>}
                    {phase === 'reveal' && viewsA !== null && (
                      <span className={`${styles.cardViews} ${winner === 'A' ? styles.win : styles.lose}`}>
                        {formatViews(viewsA)} views/mo
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.vs}>VS</div>

                <div
                  className={`${styles.card} ${phase === 'reveal' && picked === 'B' && winner === 'B' ? styles.correct : ''} ${phase === 'reveal' && picked === 'B' && winner !== 'B' ? styles.wrong : ''} ${loading ? styles.skeleton : ''}`}
                  onClick={() => guess('B')}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && phase !== 'reveal' && !loading) { e.preventDefault(); guess('B'); } }}
                  role="button"
                  tabIndex={phase === 'reveal' || loading ? -1 : 0}
                  aria-disabled={phase === 'reveal' || loading}
                >
                  <div className={styles.imageWrap}>
                    {snapB?.thumbnail && <img className={styles.cardImg} src={snapB.thumbnail} alt="" loading="lazy" />}
                    {snapB?.thumbnail && (
                      <a
                        className={styles.imageCredit}
                        href={snapB.articleUrl || articleUrl(titleB)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                      >
                        Image from Wikipedia/Wikimedia
                      </a>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.cardTitle}>{nt(titleB) || '\u00a0'}</span>
                    {snapB?.description && <span className={styles.cardDesc}>{snapB.description}</span>}
                    {phase === 'reveal' && viewsB !== null && (
                      <span className={`${styles.cardViews} ${winner === 'B' ? styles.win : styles.lose}`}>
                        {formatViews(viewsB)} views/mo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.streakRow}>
                <span className={styles.streakLabel}>Streak</span>
                <span className={styles.streakVal}>{streak}</span>
                {best > 0 && <span className={styles.bestVal}>Best: {best}</span>}
              </div>

              {loading && <div className={styles.loading}>Loading article data...</div>}
              {loadError && (
                <button className={styles.retryBtn} onClick={loadPair}>
                  {loadError}
                </button>
              )}
            </>
          )}

          {phase === 'gameover' && (
            <div className={styles.over}>
              <div className={styles.overTitle}>Game over</div>
              <div className={styles.overResult}>
                <div className={styles.overCard}>
                  <span>{nt(titleA)}</span>
                  <span className={winner === 'A' ? styles.win : styles.lose}>{viewsA !== null ? formatViews(viewsA) : '--'}</span>
                </div>
                <div className={styles.overVs}>VS</div>
                <div className={styles.overCard}>
                  <span>{nt(titleB)}</span>
                  <span className={winner === 'B' ? styles.win : styles.lose}>{viewsB !== null ? formatViews(viewsB) : '--'}</span>
                </div>
              </div>
              <div className={styles.finalStreak}>
                <span className={styles.streakLabel}>Final streak</span>
                <span className={styles.finalVal}>{streak}</span>
              </div>
              {streak > best - 1 && streak > 0 && <div className={styles.newBest}>New personal best!</div>}
              <button className={styles.restartBtn} onClick={restart}>PLAY AGAIN</button>
              <Link to="/pro" className={styles.menuBtn}>MENU</Link>
            </div>
          )}

        </main>
      )}
    </div>
  );
}
