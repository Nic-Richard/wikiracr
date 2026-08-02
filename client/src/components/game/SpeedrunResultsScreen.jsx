import { Link } from 'react-router-dom';
import NetworkBackground from '../NetworkBackground';
import ShortestPath from './ShortestPath';
import { formatTime as fmt } from '../../lib/format';
import styles from '../../pages/Game.module.css';

export default function SpeedrunResultsScreen({ results, totalRounds, motion, onPlayAgain }) {
  const { rounds, totalSeconds, timedOut } = results;

  return (
    <div className={styles.resroot}>
      <NetworkBackground parallax={motion} />
      <div className={styles.reswrap}>
        <p className={styles.resLabel}>{timedOut ? 'RUN ENDED' : 'SPEEDRUN COMPLETE'}</p>

        <div className={styles.scoreRow}>
          <span className={styles.scoreNum}>{fmt(totalSeconds)}</span>
          <span className={styles.scorePts}>total time</span>
        </div>

        <p className={styles.preclicks}>{rounds.length} of {totalRounds} rounds completed</p>

        <div className={styles.speedrunRounds}>
          {rounds.map((r, i) => (
            <div key={i} className={styles.speedrunRoundCard}>
              <div className={styles.speedrunRoundHead}>
                <span className={styles.speedrunRoundNum}>ROUND {i + 1}</span>
                <span className={styles.speedrunRoundStat}>{r.clicks} click{r.clicks !== 1 ? 's' : ''} &middot; {r.optimalClicks} optimal</span>
                <span className={styles.speedrunRoundTime}>{fmt(r.roundSeconds)}</span>
              </div>
              <ShortestPath pathTitles={r.optimalPath} label={null} />
            </div>
          ))}
        </div>

        <div className={styles.resButtons}>
          <button className={styles.resPrimary} onClick={onPlayAgain}>PLAY AGAIN</button>
          <Link to="/pro" className={styles.resSecondary}>MENU</Link>
        </div>
      </div>
    </div>
  );
}
