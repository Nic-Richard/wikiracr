import { Link } from 'react-router-dom';
import NetworkBackground from '../NetworkBackground';
import { describeScore } from '../../lib/scoring';
import { normalizeTitle as nt } from '../../lib/format';
import styles from '../../pages/Game.module.css';

export default function SoloResultsScreen({
  results,
  myPlayer,
  displayScore,
  optPath,
  optClicks,
  timedOut,
  pathReveal,
  motion,
  startTime,
  onPlayAgain,
}) {
  const elapsedForScore = results.timedOut
    ? 300
    : Math.floor(((myPlayer?.finishTime || Date.now()) - startTime) / 1000);
  const scoreInfo = describeScore(myPlayer?.clicks ?? 0, optClicks, elapsedForScore);

  return (
    <div className={styles.resroot}>
      <NetworkBackground parallax={motion} />
      <div className={styles.reswrap}>
        <p className={styles.resLabel}>{timedOut ? 'GAVE UP' : 'ROUND COMPLETE'}</p>

        <div className={styles.scoreRow}>
          <span className={styles.scoreNum}>{displayScore.toLocaleString()}</span>
          <span className={styles.scorePts}>pts</span>
        </div>

        <div className={styles.clickCompare}>
          <span className={styles.yourClicks}>{myPlayer?.clicks ?? 0} click{myPlayer?.clicks !== 1 ? 's' : ''}</span>
          <span className={styles.vsText}>vs</span>
          <span className={styles.optClicks}>{optClicks} optimal</span>
        </div>

        <p className={styles.scoreFormula}>
          Clicks {scoreInfo.clickScore.toLocaleString()} pts + time {scoreInfo.timeScore.toLocaleString()} pts
        </p>

        <div className={styles.pathsWrap}>
          <div className={styles.pathCol}>
            <p className={styles.pathColLabel}>YOUR PATH</p>
            <div className={styles.pathChips}>
              {(myPlayer?.path || []).map((article, i) => {
                if (i >= pathReveal) return null;
                const isFirst = i === 0;
                const isLast  = article.toLowerCase() === nt(results.pair?.endTitle || '').toLowerCase();
                return (
                  <div key={i} className={styles.pathChipWrap}>
                    {i > 0 && <div className={styles.pathLine} />}
                    <div className={`${styles.pathChip} ${isFirst ? styles.pathChipStart : isLast ? styles.pathChipEnd : ''}`}>
                      {nt(article)}
                      {isLast && !timedOut && <span className={styles.checkMark}>&#10003;</span>}
                    </div>
                  </div>
                );
              })}
              {timedOut && pathReveal >= (myPlayer?.path?.length || 0) && (
                <div className={styles.pathChipWrap}>
                  <div className={styles.pathLine} />
                  <div className={`${styles.pathChip} ${styles.pathX}`}>&#10005;</div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.pathDivider} />

          <div className={styles.pathCol}>
            <p className={styles.pathColLabel}>WIKIRACR FOUND</p>
            <div className={styles.pathChips}>
              {optPath.map((article, i) => {
                if (i >= pathReveal) return null;
                const isFirst = i === 0;
                const isLast  = i === optPath.length - 1;
                return (
                  <div key={i} className={styles.pathChipWrap}>
                    {i > 0 && <div className={styles.pathLine} />}
                    <div className={`${styles.pathChip} ${isFirst ? styles.pathChipStart : isLast ? styles.pathChipEnd : ''}`}>
                      {nt(article)}
                      {isLast && <span className={styles.checkMark}>&#10003;</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.resButtons}>
          <button className={styles.resPrimary} onClick={onPlayAgain}>PLAY AGAIN</button>
          <Link to="/menu" className={styles.resSecondary}>MENU</Link>
        </div>
      </div>
    </div>
  );
}
