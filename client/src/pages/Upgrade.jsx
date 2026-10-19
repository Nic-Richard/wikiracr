import Arrow from '../components/Arrow';
import { appFetch } from '../lib/platform';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useClerk } from '../lib/auth';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import styles from './Upgrade.module.css';
import { NATIVE_APP } from '../lib/platform';
import { usePlayBilling } from '../lib/usePlayBilling';
import { useIsPro } from '../lib/useIsPro';

const COMPARE_ROWS = [
  { label: 'Play solo',                guest: true,  free: true,  pro: true  },
  { label: 'Classic multiplayer',      guest: true,  free: true,  pro: true  },
  { label: 'Saved history & stats',    guest: false, free: true,  pro: true  },
  { label: 'Leaderboards',             guest: false, free: true,  pro: true  },
  { label: 'Daily Challenge',          guest: false, free: true,  pro: true  },
  { label: 'Ranked play',              guest: false, free: true,  pro: true  },
  { label: 'Join a Custom Lobby',      guest: false, free: true,  pro: true  },
  { label: 'Create a Custom Lobby',    guest: false, free: false, pro: true  },
  { label: 'Score mode',               guest: false, free: false, pro: true  },
  { label: 'Clicks mode',              guest: false, free: false, pro: true  },
  { label: 'Knockout mode',            guest: false, free: false, pro: true  },
  { label: 'Speedrun mode',            guest: false, free: false, pro: true  },
  { label: 'Higher or Lower',          guest: false, free: false, pro: true  },
];

export default function Upgrade() {
  const { getToken, isSignedIn } = useAuth();
  const { openSignIn }           = useClerk();
  const { enabled: motion }      = useMotion();
  const pending                  = useRef(false);
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState(null);
  const play = usePlayBilling();
  const isPro = useIsPro();

  useEffect(() => {
    if (isSignedIn && pending.current) {
      pending.current = false;
      if (!NATIVE_APP) triggerStripe();
    }
  }, [isSignedIn]);

  async function triggerStripe() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res   = await appFetch('/api/stripe/create-checkout', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch {
      setError('Could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleUpgrade() {
    if (!isSignedIn) {
      pending.current = true;
      openSignIn();
      return;
    }
    if (NATIVE_APP) play.subscribe();
    else triggerStripe();
  }

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <div className={styles.headerRow}>
          <Link to="/menu" className={styles.back}><Arrow left /> Back</Link>
        </div>
        <h1 className={styles.title}><span className="w">Wiki</span><span className="r">Racr</span> Pro</h1>
        <p className={styles.sub}>Get access to every game mode.</p>

        <div className={styles.compareTable}>
          <div className={`${styles.compareRow} ${styles.compareHead}`}>
            <span className={styles.compareLabel}></span>
            <span>Guest</span>
            <span>Free</span>
            <span className={styles.compareProHead}>Pro</span>
          </div>
          {COMPARE_ROWS.map(row => (
            <div key={row.label} className={styles.compareRow}>
              <span className={styles.compareLabel}>{row.label}</span>
              <span className={row.guest ? styles.yes : styles.no}>{row.guest ? '\u2713' : '\u2013'}</span>
              <span className={row.free  ? styles.yes : styles.no}>{row.free  ? '\u2713' : '\u2013'}</span>
              <span className={row.pro   ? styles.yes : styles.no}>{row.pro   ? '\u2713' : '\u2013'}</span>
            </div>
          ))}
        </div>

        <div className={styles.betaCard}>
          <b>Beta note</b>
          <span>WikiRacr Pro supports continued development while the game keeps improving. If you have questions or concerns, email support@wikiracr.com.</span>
        </div>

        {NATIVE_APP ? <>
          {(isPro || play.status?.active || play.status?.otherSubscription) ? <Link to="/pro" className={styles.upgradeBtn}>OPEN PRO FEATURES <Arrow /></Link> : <button className={styles.upgradeBtn} onClick={handleUpgrade} disabled={play.busy || (isSignedIn && !play.price)}>{!isSignedIn ? 'SIGN IN TO UPGRADE' : play.busy ? 'PLEASE WAIT...' : play.price ? `SUBSCRIBE · ${play.price}/MONTH` : 'COMING TO GOOGLE PLAY'}</button>}
          {isSignedIn && play.status?.available && <button className={styles.playAction} onClick={play.restore} disabled={play.busy}>Restore purchases</button>}
          {play.status?.subscription && <button className={styles.playAction} onClick={play.manage}>Manage Google Play subscription</button>}
          {play.status?.otherSubscription && <p className={styles.note}>Your existing Pro subscription is active. You do not need another.</p>}
          {play.notice && <p className={styles.note} role="status">{play.notice}</p>}
          {play.error && <p className={styles.errorNote} role="alert">{play.error}</p>}
        </> : <button className={styles.upgradeBtn} onClick={handleUpgrade} disabled={loading}>
          {loading ? 'REDIRECTING...' : isSignedIn ? 'UPGRADE TO PRO' : 'SIGN IN TO UPGRADE'}
        </button>}
        {!isSignedIn && <p className={styles.signInNote}>You will be asked to sign in first</p>}
        {error && <p className={styles.errorNote}>{error}</p>}
        <p className={styles.note}>{NATIVE_APP ? 'Monthly subscription. Renews automatically until cancelled in Google Play. Pricing and taxes are shown before confirmation.' : 'Cancel anytime. Billed monthly.'}</p>
      </div>
    </div>
  );
}
