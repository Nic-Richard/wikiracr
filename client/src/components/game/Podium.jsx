import styles from '../../pages/Game.module.css';

export default function Podium({
  items,
  valueFn,
  isOutFn = () => false,
  mySocketId,
  title = 'TOP 3',
  secondaryFn,
  winnerSocketId,
}) {
  const podium = items.slice(0, 3);
  return (
    <div className={styles.podiumBlock}>
      {title && <p className={styles.standingsLabel}>{title}</p>}
      <div className={styles.podiumRow}>
        {podium.map((s, i) => {
          const isWinner = winnerSocketId && s.socketId === winnerSocketId;
          const secondary = secondaryFn?.(s);
          return (
            <div
              key={s.socketId}
              className={`${styles.podiumItem} ${styles['podiumRank' + (i + 1)]} ${s.socketId === mySocketId ? styles.podiumMe : ''} ${isWinner ? styles.podiumWinner : ''} ${isOutFn(s) ? styles.podiumOut : ''}`}
            >
              <span className={styles.podiumRankLabel}>#{i + 1}{isWinner ? ' · WINNER' : ''}</span>
              <span className={styles.podiumName}>{s.username}{isOutFn(s) ? ' (out)' : ''}</span>
              <span className={styles.podiumValue}>{valueFn(s)}</span>
              {secondary && <span className={styles.podiumSubValue}>{secondary}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
