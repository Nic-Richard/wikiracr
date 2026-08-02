import { useEffect, useRef, useState } from 'react';
import { formatStandingValue, isRowOut } from '../lib/modeDisplay';
import styles from './RankPanel.module.css';

export default function RankPanel({ standings, players, mySocketId, mode, now }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const myIndex = standings.findIndex(s => s.socketId === mySocketId);
  const myRank  = myIndex >= 0 ? myIndex + 1 : null;

  return (
    <div className={styles.wrap} ref={boxRef}>
      <button className={styles.pill} onClick={() => setOpen(o => !o)}>
        <span className={styles.pillLabel}>rank</span>
        <span className={styles.pillRank}>
          {myRank ?? '-'}<span className={styles.pillTotal}>/{standings.length}</span>
        </span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {standings.map((s, i) => {
            const live = players.find(p => p.socketId === s.socketId);
            const out  = isRowOut(s);
            return (
              <div
                key={s.socketId}
                className={`${styles.row} ${s.socketId === mySocketId ? styles.rowMe : ''} ${out ? styles.rowOut : ''}`}
              >
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.name}>{s.username}</span>
                {!out && live?.disconnected && (
                  <span className={styles.away}>
                    {live.graceExpiresAt ? `Forfeit in ${Math.max(0, Math.ceil((live.graceExpiresAt - now) / 1000))}s` : 'AWAY'}
                  </span>
                )}
                {!out && live?.finished && <span className={styles.check}>&#10003;</span>}
                <span className={styles.value}>{formatStandingValue(mode, s)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
