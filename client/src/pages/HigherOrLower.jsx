import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { useIsPro } from '../lib/useIsPro';
import { normalizeTitle as nt } from '../lib/format';
import styles from './HigherOrLower.module.css';


const FALLBACK_ARTICLES = [
  'Taylor Swift', 'The Beatles', 'Michael Jackson', 'Elvis Presley', 'Beyoncé',
  'Albert Einstein', 'Isaac Newton', 'Nikola Tesla', 'Stephen Hawking',
  'World War II', 'World War I', 'French Revolution', 'American Civil War',
  'United States', 'China', 'India', 'United Kingdom', 'Russia',
  'New York City', 'London', 'Paris', 'Tokyo', 'Sydney',
  'Elon Musk', 'Jeff Bezos', 'Bill Gates', 'Steve Jobs', 'Mark Zuckerberg',
  'Jesus', 'Muhammad', 'Adolf Hitler', 'Napoleon Bonaparte', 'Julius Caesar',
  'Barack Obama', 'Donald Trump', 'Abraham Lincoln', 'Winston Churchill',
  'Spider-Man', 'Batman', 'Superman', 'Iron Man',
  'Titanic (1997 film)', 'Avatar (2009 film)', 'The Dark Knight',
  'Game of Thrones', 'Breaking Bad', 'Friends (TV series)',
  'Minecraft', 'Grand Theft Auto V', 'Fortnite', 'League of Legends',
  'Dog', 'Cat', 'Lion', 'Tiger', 'Elephant',
  'Pizza', 'Hamburger', 'Sushi', 'Coffee',
  'Moon', 'Mars', 'Black hole', 'Solar System',
  'DNA', 'Evolution', 'Quantum mechanics', 'Artificial intelligence',
  'Association football', 'Basketball', 'Tennis',
  'LeBron James', 'Michael Jordan', 'Cristiano Ronaldo', 'Lionel Messi',
  'Bitcoin', 'Cryptocurrency',
  'Apple Inc.', 'Google', 'Amazon (company)', 'Microsoft',
  'Harry Potter', 'The Lord of the Rings', 'Star Wars',
  'William Shakespeare', 'Charles Darwin', 'Leonardo da Vinci',
  'Roman Empire', 'Ancient Egypt', 'Ancient Greece',
  'Climate change', 'COVID-19 pandemic',
  'Human', 'Earth', 'Universe', 'Water',
  'Music', 'Art', 'Science', 'Mathematics', 'Philosophy',
  'Death', 'Love', 'War', 'Religion',
  'Cleopatra', 'Aristotle', 'Socrates', 'Plato',
  'English language', 'Spanish language', 'French language',
  'Nutrition', 'Exercise', 'Depression (mood)', 'Anxiety',
];

function articleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

function formatViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

async function fetchViews(title) {
  const now     = new Date();
  const d       = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year    = d.getFullYear();
  const month   = String(d.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
  const start   = `${year}${month}01`;
  const end     = `${year}${month}${String(lastDay).padStart(2, '0')}`;

  try {
    const res = await fetch(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(title)}/monthly/${start}/${end}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.views ?? null;
  } catch {
    return null;
  }
}

let ACTIVE_ARTICLES = FALLBACK_ARTICLES;
let articlesFetchPromise = null;

function ensureArticlesLoaded() {
  if (articlesFetchPromise) return articlesFetchPromise;
  articlesFetchPromise = fetch('/api/higherlower/articles')
    .then(r => r.json())
    .then(({ articles }) => {
      if (Array.isArray(articles) && articles.length >= 50) {
        ACTIVE_ARTICLES = articles;
      }
    })
    .catch(() => {});
  return articlesFetchPromise;
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

function pickPair(exclude = []) {
  const pool = ACTIVE_ARTICLES.filter(a => !exclude.includes(a));
  if (pool.length < 2) return [ACTIVE_ARTICLES[0], ACTIVE_ARTICLES[1]];
  const a = pool[Math.floor(Math.random() * pool.length)];
  let b;
  do { b = pool[Math.floor(Math.random() * pool.length)]; } while (b === a);
  return [a, b];
}

export default function HigherOrLower() {
  const isPro       = useIsPro();
  const { isSignedIn, user } = useUser();
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
  const [seen, setSeen]       = useState([]);
  const [snapA, setSnapA]     = useState(null);
  const [snapB, setSnapB]     = useState(null);

  const loadPair = useCallback(async (exclude = []) => {
    setLoading(true);
    setPhase('playing');
    setPicked(null);
    setLoadError('');
    setViewsA(null);
    setViewsB(null);
    setSnapA(null);
    setSnapB(null);

    let a, b, va, vb;
    let attempts = 0;

    do {
      [a, b] = pickPair(exclude);
      [va, vb] = await Promise.all([fetchViews(a), fetchViews(b)]);
      attempts++;
    } while ((va === null || vb === null || va === vb) && attempts < 8);

    if (va === null || vb === null || va === vb) {
      setLoading(false);
      setLoadError('Could not load article data. Try again.');
      return;
    }

    setTitleA(a);
    setTitleB(b);
    setViewsA(va);
    setViewsB(vb);
    setSeen(prev => [...prev, a, b]);
    setLoading(false);

    fetchSnapshot(a).then(setSnapA);
    fetchSnapshot(b).then(setSnapB);
  }, []);

  useEffect(() => {
    ensureArticlesLoaded().then(() => loadPair());
  }, []);

  useEffect(() => {
    if (!isPro || !isSignedIn) return;
    getToken().then(token =>
      fetch('/api/higherlower/best', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setBest(prev => Math.max(prev, d.best || 0)))
        .catch(() => {})
    );
  }, [isPro, isSignedIn]);

  function guess(pick) {
    if (phase !== 'playing' || loading) return;
    setPicked(pick);
    setPhase('reveal');

    const correct = pick === 'A' ? viewsA > viewsB : viewsB > viewsA;

    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBest(prev => Math.max(prev, newStreak));
      submitStreak(newStreak);
      setTimeout(() => loadPair(seen.length > ACTIVE_ARTICLES.length * 0.6 ? [] : seen), 1800);
    } else {
      setPhase('gameover');
      submitStreak(streak);
    }
  }

  function submitStreak(finalStreak) {
    if (!isSignedIn || finalStreak <= 0) return;
    getToken().then(token =>
      fetch('/api/higherlower/streak', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username || user?.firstName || 'Guest', streak: finalStreak }),
      })
        .then(r => r.json())
        .then(d => { if (d.ok) setBest(prev => Math.max(prev, d.best)); })
        .catch(() => {})
    );
  }

  function restart() {
    setStreak(0);
    setSeen([]);
    loadPair([]);
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
                <button className={styles.retryBtn} onClick={() => loadPair(seen.length > ACTIVE_ARTICLES.length * 0.6 ? [] : seen)}>
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
