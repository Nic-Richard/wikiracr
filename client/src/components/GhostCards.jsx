import { useEffect, useState } from 'react';
import styles from './GhostCards.module.css';

const TOPS = ['9%', '37%', '65%'];
const ROTS = ['1.1deg', '-0.8deg', '0.7deg'];

const OFFSETS = [0, 0.8, -0.4];

const CYCLE_MS = 11000;

export default function GhostCards({ sequences, tilt, motionEnabled }) {
  const [seqIdx, setSeqIdx]   = useState(0);
  const [isRight, setIsRight] = useState(false);
  const [basePct, setBasePct] = useState(3);
  const [shown, setShown]     = useState(0);

  useEffect(() => {
    let seq  = 0;
    let side = false;
    const timers = [];

    function show() {
      timers.push(setTimeout(() => setShown(1), 300));
      timers.push(setTimeout(() => setShown(2), 1700));
      timers.push(setTimeout(() => setShown(3), 3100));
    }

    function cycle() {
      setShown(0);
      timers.push(setTimeout(() => {
        seq  = (seq + 1) % sequences.length;
        side = !side;
        setSeqIdx(seq);
        setIsRight(side);
        setBasePct(2 + Math.random() * 19);
        show();
      }, 900));
    }

    show();
    const interval = setInterval(cycle, CYCLE_MS);
    return () => { clearInterval(interval); timers.forEach(clearTimeout); };
  }, [sequences]);

  function cardStyle(i) {
    const pct = `${(basePct + OFFSETS[i]).toFixed(1)}%`;
    return {
      top:        TOPS[i],
      left:       !isRight ? pct : 'auto',
      right:      isRight  ? pct : 'auto',
      opacity:    shown > i ? 1 : 0,
      transform: motionEnabled
        ? `rotate(${ROTS[i]}) translate(${-tilt.x * 6}px, ${-tilt.y * 6}px)`
        : `rotate(${ROTS[i]})`,
      transition: 'opacity 0.9s ease, transform 0.2s ease-out',
    };
  }

  const seq = sequences[seqIdx];

  return (
    <div className={styles.cards}>
      {seq.map((card, i) => (
        <div key={`${seqIdx}-${i}`} className={styles.wcard} style={cardStyle(i)}>
          <div className={styles.wcardTitle}>{card.title}</div>
          <div className={styles.wcardBody}>{card.body}</div>
          <div className={styles.wcardLinks}>
            {card.links.map((link, j) => (
              <span key={j} className={`${styles.wcardLink} ${j === card.active ? styles.activeLink : ''}`}>
                {link}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
