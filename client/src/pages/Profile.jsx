import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useAuth, SignInButton } from '@clerk/clerk-react';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { formatTime as fmt, normalizeTitle as nt } from '../lib/format';
import { RANK_CLASS } from '../lib/rankDisplay';
import { useIsPro } from '../lib/useIsPro';
import styles from './Profile.module.css';

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', random: 'Random' };

export default function Profile() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { getToken }        = useAuth();
  const { enabled: motion } = useMotion();

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const isPro = useIsPro();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, historyRes] = await Promise.all([
          fetch('/api/me/profile', { headers }),
          fetch('/api/me/history', { headers }),
        ]);
        setProfile(await profileRes.json());
        setHistory((await historyRes.json()).history || []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  if (isLoaded && !isSignedIn) {
    return (
      <div className={styles.root}>
        <NetworkBackground parallax={motion} />
        <div className={styles.gateWrap}>
          <p className={styles.tag}>ACCOUNT</p>
          <h1 className={styles.gateTitle}>Your Profile</h1>
          <p className={styles.gateDesc}>Sign in to see your rank, stats, and game history.</p>
          <SignInButton mode="modal" afterSignInUrl="/profile">
            <button className={styles.gateBtn}>Sign in</button>
          </SignInButton>
          <Link to="/menu" className={styles.gateBack}>Back to menu</Link>
        </div>
      </div>
    );
  }

  if (loading || !profile) {
    return <div className={styles.root}><div className={styles.spinner} /></div>;
  }

  const { stats, elo, dailyStreak, bestDailyStreak, speedrunBests } = profile;
  const winRate = (elo.wins + elo.losses) > 0 ? Math.round((elo.wins / (elo.wins + elo.losses)) * 100) : null;

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <div className={styles.header}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <Link to="/menu" className={styles.back}>&#8592; Back</Link>
        </div>

        <div className={styles.identity}>
          {user?.imageUrl && <img className={styles.avatar} src={user.imageUrl} alt="" />}
          <div>
            <h1 className={styles.username}>{user?.username || user?.firstName || 'Player'}</h1>
            {isPro && <span className={styles.proBadge}>PRO</span>}
          </div>
        </div>

        <div className={styles.cards}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>1V1 RATING</p>
            {elo.isPlacement ? (
              <>
                <p className={styles.cardBig}>{elo.gamesPlayed}/5</p>
                <p className={styles.cardSub}>Placement matches</p>
              </>
            ) : (
              <>
                <span className={`${styles.rankBadge} ${styles[RANK_CLASS[elo.rank]] || ''}`}>{elo.rank}</span>
                <p className={styles.cardBig}>{elo.elo}</p>
                <p className={styles.cardSub}>
                  {elo.wins}W&ndash;{elo.losses}L{winRate !== null ? ` (${winRate}%)` : ''}
                </p>
              </>
            )}
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>DAILY STREAK</p>
            <p className={styles.cardBig}>&#128293; {dailyStreak}</p>
            <p className={styles.cardSub}>Best: {bestDailyStreak} day{bestDailyStreak !== 1 ? 's' : ''}</p>
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>SOLO STATS</p>
            <p className={styles.cardBig}>{stats.total_games || 0}</p>
            <p className={styles.cardSub}>games &middot; avg {stats.avg_clicks ?? '-'} clicks</p>
            <p className={styles.cardSub}>Best score: {stats.best_score != null ? Number(stats.best_score).toLocaleString() : '-'}</p>
          </div>
        </div>

        {speedrunBests.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>SPEEDRUN PERSONAL BESTS</p>
            <div className={styles.speedrunGrid}>
              {speedrunBests.map(sb => (
                <div key={sb.difficulty} className={styles.speedrunCard}>
                  <span className={styles.speedrunDiff}>{DIFFICULTY_LABELS[sb.difficulty] || sb.difficulty}</span>
                  <span className={styles.speedrunTime}>{fmt(sb.total_seconds)}</span>
                  <span className={styles.speedrunClicks}>{sb.clicks} clicks total</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionLabel}>RECENT GAMES</p>
          {history.length === 0 && <p className={styles.empty}>No games played yet.</p>}
          <div className={styles.historyList}>
            {history.map((h, i) => (
              <div key={i} className={styles.historyRow}>
                <span className={styles.historyMode}>{h.mode}</span>
                <span className={styles.historyPair}>{nt(h.start_title)} &#8594; {nt(h.end_title)}</span>
                <span className={styles.historyClicks}>{h.clicks} clicks</span>
                <span className={`${styles.historyScore} ${!h.completed ? styles.historyDnf : ''}`}>
                  {h.completed ? (h.mode === 'daily' ? 'Daily' : `${Number(h.score || 0).toLocaleString()} pts`) : 'DNF'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
