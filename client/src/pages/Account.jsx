import { appFetch } from '../lib/platform';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignInButton, useAuth, useClerk, useUser } from '../lib/auth';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { useGamePreferences } from '../lib/GamePreferencesContext';
import { formatTime as fmt } from '../lib/format';
import { RANK_CLASS } from '../lib/rankDisplay';
import { useIsPro } from '../lib/useIsPro';
import styles from './Account.module.css';
import { NATIVE_APP } from '../lib/platform';

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletionState, setDeletionState] = useState(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let stopped = false;
    (async () => {
      const token = await getToken();
      const response = await appFetch('/api/account-deletion', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        if (!stopped && data.state !== 'none') setDeletionState(data.state);
      }
    })().catch(() => {});
    return () => { stopped = true; };
  }, [getToken, isLoaded, isSignedIn]);

  async function deleteAccount() {
    if (deleting || confirmation !== 'DELETE') return;
    setDeleting(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await appFetch('/api/account-deletion', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not request account deletion. Please try again.');
      setDeletionState(data.state);
    } catch (error) { setError(error.message); }
    finally { setDeleting(false); }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoadingProfile(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await appFetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await appFetch('/api/stripe/create-checkout', {
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
      openSignIn({ forceRedirectUrl: '/account' });
      return;
    }
    startCheckout();
  }

  async function manageSubscription() {
    setBillingLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await appFetch('/api/stripe/create-portal-session', {
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
                <SignInButton mode="modal" forceRedirectUrl="/account">
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
                <p className={styles.muted}>{isPro ? 'Your Pro features are active.' : NATIVE_APP ? 'Free play and your existing account are available here.' : 'Upgrade when you want the full game.'}</p>
              </div>
              <span className={`${styles.tierPill} ${isPro ? styles.proPill : ''}`}>{tier}</span>
            </div>
            <ul className={styles.benefits}>
              {PRO_BENEFITS.map(item => <li key={item}>{item}</li>)}
            </ul>
            {NATIVE_APP ? <Link className={styles.goldBtn} to="/upgrade">{isPro ? 'Pro and subscription options' : 'View Pro plans'}</Link> : isPro ? (
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
              <p>Manage web subscriptions through Stripe and Android subscriptions through Google Play. Use Pro and subscription options for your account.</p>
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
                  <p>Delete your sign-in, game history, progress, scores, rankings and linked reports. Active WikiRacr subscriptions are cancelled. This cannot be undone.</p>
                  {deletionState ? (
                    <p role="status">Deletion is requested and account access is closed. Failed cleanup steps retry automatically. You can sign out while this finishes.</p>
                  ) : deleteOpen ? (
                    <div className={styles.actions}>
                      <label htmlFor="delete-confirmation">Type DELETE to confirm permanent deletion</label>
                      <input id="delete-confirmation" className={styles.confirmInput} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={deleting} autoComplete="off" />
                      <button className={styles.deleteBtn} disabled={deleting || confirmation !== 'DELETE'} onClick={deleteAccount}>{deleting ? 'Requesting deletion...' : 'Permanently delete my account'}</button>
                      <button className={styles.secondaryBtn} disabled={deleting} onClick={() => { setDeleteOpen(false); setConfirmation(''); }}>Keep my account</button>
                    </div>
                  ) : <button className={styles.deleteBtn} onClick={() => setDeleteOpen(true)}>Delete account</button>}
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <p className={styles.muted}>Sign in to manage security settings for your account.</p>
                <SignInButton mode="modal" forceRedirectUrl="/account">
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
