import NetworkBackground from '../NetworkBackground';
import { normalizeTitle as nt } from '../../lib/format';
import styles from '../../pages/Game.module.css';

export default function PreroundScreen({
  pair,
  chipReveal,
  countdown,
  isSpeedrun,
  roundNum,
  speedrunRounds,
  motion,
}) {
  const hiddenCount = pair.pathLength - 1;
  const showCountdown = chipReveal > 2 + hiddenCount;

  return (
    <div className={styles.preroot}>
      <NetworkBackground parallax={motion} />
      <div className={styles.preglow} />
      <div className={styles.prewrap}>
        <p className={styles.prelabel}>
          {isSpeedrun ? `SPEEDRUN · ROUND ${roundNum} OF ${speedrunRounds}` : 'YOUR CHALLENGE'}
        </p>
        <div className={styles.prechips}>
          {chipReveal >= 1 && (
            <span className={`${styles.chip} ${styles.chipStart} ${styles.chipIn}`}>
              {nt(pair.startTitle)}
            </span>
          )}
          {Array.from({ length: hiddenCount }).map((_, i) => chipReveal >= i + 2 && (
            <span key={i} className={styles.chiprow}>
              <span className={styles.chipArrow}>&#8594;</span>
              <span className={`${styles.chip} ${styles.chipMid} ${styles.chipIn}`}>???</span>
            </span>
          ))}
          {chipReveal >= 2 + hiddenCount && (
            <span className={styles.chiprow}>
              <span className={styles.chipArrow}>&#8594;</span>
              <span className={`${styles.chip} ${styles.chipEnd} ${styles.chipIn}`}>
                {nt(pair.endTitle)}
              </span>
            </span>
          )}
        </div>
        <p className={styles.preclicks}>
          {pair.pathLength} click{pair.pathLength !== 1 ? 's' : ''} to shortest path
        </p>
        {showCountdown && (
          <div key={countdown} className={styles.countdownBelow}>
            {countdown > 0 ? countdown : 'GO'}
          </div>
        )}
      </div>
    </div>
  );
}
