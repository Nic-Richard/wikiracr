import styles from '../../pages/Game.module.css';

export default function StandingsList({
  items,
  valueFn,
  isOutFn = () => false,
  mySocketId,
  title = 'STANDINGS',
  secondaryFn,
  winnerSocketId,
}) {
  return (
    <div className={styles.standingsBlock}>
      {title && <p className={styles.standingsLabel}>{title}</p>}
      <div className={styles.standingsList}>
        {items.map((s, i) => {
          const isWinner = winnerSocketId && s.socketId === winnerSocketId;
          const secondary = secondaryFn?.(s);
          return (
            <div
              key={s.socketId}
              className={`${styles.standingRow} ${s.socketId === mySocketId ? styles.standingMe : ''} ${isWinner ? styles.standingWinnerRow : ''} ${isOutFn(s) ? styles.standingOut : ''}`}
            >
              <div className={styles.standingLeft}>
                <span className={styles.standingRank}>#{i + 1}</span>
                <span className={styles.standingName}>{s.username}{isOutFn(s) ? ' (out)' : ''}</span>
                {isWinner && <span className={styles.winnerChip}>winner</span>}
              </div>
              <div className={styles.standingRight}>
                <span className={styles.standingValue}>{valueFn(s)}</span>
                {secondary && <span className={styles.standingSubValue}>{secondary}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
