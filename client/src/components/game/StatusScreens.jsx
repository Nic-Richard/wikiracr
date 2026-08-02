import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import styles from '../../pages/Game.module.css';

export function ProRequiredScreen({ rounds }) {
  return (
    <div className={styles.loading}>
      <div className={styles.errBox}>
        <p className={styles.errTitle}>Speedrun is a Pro feature</p>
        <p className={styles.errMsg}>Upgrade to race the clock across {rounds} pairs back to back.</p>
        <Link to="/upgrade" className={styles.errBack}>Upgrade to Pro</Link>
      </div>
    </div>
  );
}

export function ErrorScreen({ title, message, backTo = '/menu', backLabel = 'Back to menu' }) {
  return (
    <div className={styles.loading}>
      <div className={styles.errBox}>
        <p className={styles.errTitle}>{title}</p>
        <p className={styles.errMsg}>{message}</p>
        <Link to={backTo} className={styles.errBack}>{backLabel}</Link>
      </div>
    </div>
  );
}

export function LoadingScreen({ isSpeedrun, roundNum, speedrunRounds }) {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      {isSpeedrun && roundNum > 1 && (
        <p className={styles.loadingSub}>Round {roundNum} of {speedrunRounds}</p>
      )}
    </div>
  );
}

export function SignInRequiredScreen({ code }) {
  return (
    <div className={styles.loading}>
      <div className={styles.errBox}>
        <p className={styles.errTitle}>Sign in to join this lobby</p>
        <p className={styles.errMsg}>Custom lobbies need an account so everyone has a username. Free or Pro both work, only creating a custom lobby needs Pro.</p>
        <SignInButton mode="modal" afterSignInUrl={`/room/${code}`} afterSignUpUrl={`/room/${code}`}>
          <button className={styles.resPrimary}>Sign in or create account</button>
        </SignInButton>
        <Link to="/menu" className={styles.errBack}>Back to menu</Link>
      </div>
    </div>
  );
}

export function ReconnectWaitScreen() {
  return (
    <div className={styles.loading}>
      <div className={styles.errBox}>
        <p className={styles.errTitle}>You&rsquo;re back in</p>
        <p className={styles.errMsg}>You forfeited the round you dropped during, but you&rsquo;re still in the match. Waiting for the next round to start...</p>
        <div className={styles.spinner} />
      </div>
    </div>
  );
}
