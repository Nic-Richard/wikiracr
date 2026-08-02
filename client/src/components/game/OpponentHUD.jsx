import RankPanel from '../RankPanel';
import { formatStandingValue } from '../../lib/modeDisplay';
import styles from '../../pages/Game.module.css';

export default function OpponentHUD({ opponents, standings, players, mySocketId, mode, now }) {
  if (!opponents.length) return null;

  if (opponents.length > 4) {
    return <RankPanel standings={standings} players={players} mySocketId={mySocketId} mode={mode} now={now} />;
  }

  return (
    <div className={styles.opponents}>
      {opponents.map(p => {
        const st = standings.find(s => s.socketId === p.socketId)
          || { roundWins: 0, totalScore: 0, totalClicks: 0, totalTimeSeconds: 0, hp: '-', eliminated: false };
        const isDisconnected = p.disconnected || st.disconnected;
        return (
          <div key={p.socketId} className={`${styles.opp} ${p.gaveUp ? styles.oppGaveUp : p.finished ? styles.oppDone : ''} ${st.eliminated ? styles.oppEliminated : ''}`}>
            <span className={styles.oppName}>{p.username}</span>
            {isDisconnected && !st.eliminated && (
              <span className={styles.oppAway}>
                {p.graceExpiresAt ? `Forfeit in ${Math.max(0, Math.ceil((p.graceExpiresAt - now) / 1000))}s` : 'AWAY'}
              </span>
            )}
            <span className={
              mode === 'knockout'
                ? (st.eliminated ? styles.oppOut : styles.oppHp)
                : styles.oppWins
            }>{formatStandingValue(mode, st)}</span>
            <span className={styles.oppClicks}>{p.clicks}</span>
            {p.gaveUp ? <span className={styles.oppX}>&#10005;</span> : p.finished ? <span className={styles.oppCheck}>&#10003;</span> : null}
          </div>
        );
      })}
    </div>
  );
}
