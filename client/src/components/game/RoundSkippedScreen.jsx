import NetworkBackground from '../NetworkBackground';
import styles from '../../pages/Game.module.css';

export default function RoundSkippedScreen({ mode, roundNum, maxRounds, motion }) {
  return (
    <div className={styles.resroot}>
      <NetworkBackground parallax={motion} />
      <div className={styles.reswrap}>
        <p className={styles.resLabel}>
          {mode === 'knockout' ? `ROUND ${roundNum}` : `ROUND ${roundNum} OF ${maxRounds}`}
        </p>
        <h2 className={styles.roundBannerTitle}>Round skipped</h2>
        <p className={styles.preclicks}>Dealing a new pair...</p>
      </div>
    </div>
  );
}
