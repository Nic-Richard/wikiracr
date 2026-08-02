import { useState, useEffect } from 'react';
import styles from './GameHUD.module.css';

export default function GameHUD({ startTitle, endTitle, currentArticle, path, clicks, players, startTime, isSolo }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  return (
    <div className={styles.hud}>
      <div className={styles.left}>
        <span className={styles.start}>{startTitle}</span>
        <span className={styles.sep}>&#8594;</span>
        <span className={styles.current}>{currentArticle}</span>
        <span className={styles.sep}>&#8594;</span>
        <span className={styles.goal}>{endTitle}</span>
      </div>

      <div className={styles.center}>
        <span className={styles.timer}>{mins}:{secs}</span>
        <span className={styles.clicks}>{clicks} click{clicks !== 1 ? 's' : ''}</span>
      </div>

      {!isSolo && players.length > 0 && (
        <div className={styles.right}>
          {players.map(p => (
            <div key={p.socketId} className={`${styles.player} ${p.finished ? styles.done : ''}`}>
              <span className={styles.playerName}>{p.username}</span>
              <span className={styles.playerClicks}>{p.clicks}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
