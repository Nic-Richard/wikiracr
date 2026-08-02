import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignInButton, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { useGamePreferences } from '../lib/GamePreferencesContext';
import { formatTime as fmt } from '../lib/format';
import { RANK_CLASS } from '../lib/rankDisplay';
import { useIsPro } from '../lib/useIsPro';
import styles from './Account.module.css';

const PRO_BENEFITS = [
  'Create Custom Lobbies',
  'Speedrun mode',
  'Higher or Lower',
  'All free account features',
];

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', random: 'Random' };

function formatDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function bestSpeedrun(speedrunBests = []) {
  if (!speedrunBests.length) return null;
  return [...speedrunBests].sort((a, b) => a.total_seconds - b.total_seconds)[0];
}

export default function Account() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { openSignIn, openUserProfile, signOut } = useClerk();
  const navigate = useNavigate();
  const { enabled: motion, toggle: toggleMotion } = useMotion();
  const { muted, chatEnabled, toggleMute, toggleChat } = useGamePreferences();
  const isPro = useIsPro();
  const pendingUpgrade = useRef(false);

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoadingProfile(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setError('Could not load account stats.');
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (isSignedIn && pendingUpgrade.current) {
      pendingUpgrade.current = false;
      startCheckout();
    }
  }, [isSignedIn]);

  const displayName = useMemo(() => {
    if (!isSignedIn) return 'Guest player';
    return user?.username || user?.fullName || user?.firstName || 'WikiRacr player';
  }, [isSignedIn, user]);

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
  const joinedDate = formatDate(user?.createdAt);
  const tier = !isSignedIn ? 'Guest' : isPro ? 'Pro' : 'Free';
  const stats = profile?.stats || {};
  const elo = profile?.elo;
  const run = bestSpeedrun(profile?.speedrunBests || []);

  async function startCheckout() {
    setUpgradeLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch {
      setError('Could not start checkout. Please try again.');
    } finally {
      setUpgradeLoading(false);
    }
  }

  function handleUpgrade() {
    if (!isSignedIn) {
      pendingUpgrade.current = true;
      openSignIn({ afterSignInUrl: '/account' });
      return;
    }
    startCheckout();
  }

  async function manageSubscription() {
    setBillingLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch {
      setError('Could not open the billing portal.');
    } finally {
      setBillingLoading(false);
    }
  }

  function openClerkProfile() {
    if (typeof openUserProfile === 'function') openUserProfile();
  }


  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <div className={styles.header}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <div className={styles.headerLinks}>
            <Link to="/profile" className={styles.topLink}>Profile</Link>
            <Link to="/menu" className={styles.topLink}>Back</Link>
          </div>
        </div>

        <div className={styles.hero}>
          <p className={styles.kicker}>ACCOUNT</p>
          <h1>Account Settings</h1>
          <p>Manage your player identity, Pro status, and local game preferences.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.grid}>
          <section className={`${styles.card} ${styles.profileCard}`}>
            <div className={styles.profileTop}>
              {user?.imageUrl ? <img className={styles.avatar} src={user.imageUrl} alt="" /> : <div className={styles.avatarFallback}>{displayName.charAt(0).toUpperCase()}</div>}
              <div>
                <p className={styles.cardLabel}>PROFILE</p>
                <h2>{displayName}</h2>
                {email && <p className={styles.muted}>{email}</p>}
              </div>
            </div>
            <div className={styles.metaGrid}>
              <div>
                <span>Tier</span>
                <strong className={isPro ? styles.proText : ''}>{tier}</strong>
              </div>
              {joinedDate && (
                <div>
                  <span>Joined</span>
                  <strong>{joinedDate}</strong>
                </div>
              )}
            </div>
            {isSignedIn && typeof openUserProfile === 'function' && (
              <button className={styles.secondaryBtn} onClick={openClerkProfile}>Edit public profile</button>
            )}
            {!isSignedIn && (
              <div className={styles.guestBox}>
                <p>Guests can play Solo and default Classic rooms. Sign in free to save history, play Daily, use Ranked, and join Custom Lobbies.</p>
                <SignInButton mode="modal" afterSignInUrl="/account">
                  <button className={styles.primaryBtn}>Sign in free</button>
                </SignInButton>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <p className={styles.cardLabel}>SUBSCRIPTION</p>
            <div className={styles.planRow}>
              <div>
                <h2>{isPro ? 'WikiRacr Pro' : isSignedIn ? 'Free account' : 'Guest'}</h2>
                <p className={styles.muted}>{isPro ? 'Your Pro features are active.' : 'Upgrade when you want the full game.'}</p>
              </div>
              <span className={`${styles.tierPill} ${isPro ? styles.proPill : ''}`}>{tier}</span>
            </div>
            <ul className={styles.benefits}>
              {PRO_BENEFITS.map(item => <li key={item}>{item}</li>)}
            </ul>
            {isPro ? (
              <button className={styles.goldBtn} onClick={manageSubscription} disabled={billingLoading}>{billingLoading ? 'Opening...' : 'Manage Subscription'}</button>
            ) : (
              <button className={styles.goldBtn} onClick={handleUpgrade} disabled={upgradeLoading}>{upgradeLoading ? 'Opening...' : isSignedIn ? 'Upgrade to Pro' : 'Sign in to upgrade'}</button>
            )}
          </section>

          <section className={`${styles.card} ${styles.wide}`}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.cardLabel}>GAME IDENTITY</p>
                <h2>Stats snapshot</h2>
              </div>
              {isSignedIn && <Link to="/profile" className={styles.textBtn}>View full profile</Link>}
            </div>
            {!isSignedIn ? (
              <p className={styles.empty}>Sign in to track ranking, streaks, scores, and speedrun personal bests.</p>
            ) : loadingProfile ? (
              <div className={styles.statSkeleton}>Loading stats...</div>
            ) : (
              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <span>Ranked</span>
                  {elo?.isPlacement ? <strong>{elo.gamesPlayed}/5 placement</strong> : <strong className={`${styles.rank} ${styles[RANK_CLASS[elo?.rank]] || ''}`}>{elo?.rank || 'Unranked'} {elo?.elo || ''}</strong>}
                </div>
                <div className={styles.statBox}>
                  <span>Daily streak</span>
                  <strong>{profile?.dailyStreak ?? 0}</strong>
                </div>
                <div className={styles.statBox}>
                  <span>Solo games</span>
                  <strong>{stats.total_games || 0}</strong>
                </div>
                <div className={styles.statBox}>
                  <span>Best solo score</span>
                  <strong>{stats.best_score != null ? Number(stats.best_score).toLocaleString() : '-'}</strong>
                </div>
                <div className={`${styles.statBox} ${styles.statWide}`}>
                  <span>Best speedrun</span>
                  <strong>{run ? `${DIFFICULTY_LABELS[run.difficulty] || run.difficulty}: ${fmt(run.total_seconds)} with ${run.clicks} clicks` : '-'}</strong>
                </div>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <p className={styles.cardLabel}>PREFERENCES</p>
            <div className={styles.prefRow}>
              <div>
                <h3>Motion effects</h3>
                <p>Controls the animated background and menu tilt on this device.</p>
              </div>
              <button className={`${styles.toggle} ${motion ? styles.toggleOn : ''}`} onClick={toggleMotion} aria-pressed={motion}>
                <span />
              </button>
            </div>
            <div className={styles.prefRow}>
              <div>
                <h3>Game audio</h3>
                <p>Mute round sounds and other in-game audio on this device.</p>
              </div>
              <button className={`${styles.toggle} ${!muted ? styles.toggleOn : ''}`} onClick={toggleMute} aria-pressed={!muted}>
                <span />
              </button>
            </div>
            <div className={styles.prefRow}>
              <div>
                <h3>In-game chat</h3>
                <p>Show the multiplayer chat panel by default on this device.</p>
              </div>
              <button className={`${styles.toggle} ${chatEnabled ? styles.toggleOn : ''}`} onClick={toggleChat} aria-pressed={chatEnabled}>
                <span />
              </button>
            </div>
          </section>



          <section className={styles.card}>
            <p className={styles.cardLabel}>LEGAL & SUPPORT</p>
            <div className={styles.supportCard}>
              <h3>Need help?</h3>
              <p>For account, billing, report, or gameplay issues, email <a href="mailto:support@wikiracr.com">support@wikiracr.com</a>.</p>
              <p>Pro billing and cancellations are handled through Stripe's billing portal when available.</p>
              <div className={styles.supportLinks}>
                <Link to="/terms" className={styles.secondaryBtn}>Terms</Link>
                <Link to="/privacy" className={styles.secondaryBtn}>Privacy</Link>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <p className={styles.cardLabel}>SECURITY</p>
            {isSignedIn ? (
              <div className={styles.actions}>
                {typeof openUserProfile === 'function' && <button className={styles.secondaryBtn} onClick={openClerkProfile}>Manage login details</button>}
                <button className={styles.secondaryBtn} onClick={() => signOut(() => navigate('/'))}>Sign out</button>
                <div className={styles.securityNote}>
                  <h3>Account deletion</h3>
                  <p>Use Manage login details, then scroll to the bottom of Clerk's profile panel to delete your account.</p>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <p className={styles.muted}>Sign in to manage security settings for your account.</p>
                <SignInButton mode="modal" afterSignInUrl="/account">
                  <button className={styles.secondaryBtn}>Sign in</button>
                </SignInButton>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
