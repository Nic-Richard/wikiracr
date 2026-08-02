import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { useIsPro } from '../lib/useIsPro';
import { DIFFICULTIES } from '../lib/difficulties';
import styles from './Speedrun.module.css';

export default function Speedrun() {
  const { enabled: motion } = useMotion();
  const navigate = useNavigate();
  const [diff, setDiff] = useState('random');

  const isPro = useIsPro();

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <div className={styles.headerRow}>
          <p className={styles.tag}>PRO &middot; SPEEDRUN</p>
          <Link to={isPro ? '/pro' : '/menu'} className={styles.backLink}>&#8592; Back</Link>
        </div>
        <h1 className={styles.title}>Speedrun</h1>
        <p className={styles.subtitle}>Five article pairs, back to back. Only your total time counts, not path length. Classic scores your route and your speed together, Speedrun comes down to one number: how fast you clear all five.</p>

        {isPro ? (
          <>
            <div className={styles.diffGrid}>
              {DIFFICULTIES.map(d => (
                <div
                  key={d.key}
                  className={`${styles.diffTile} ${d.key === 'random' ? styles.diffTileWide : ''} ${diff === d.key ? styles.sel : ''}`}
                  onClick={() => setDiff(d.key)}
                >
                  <div className={styles.diffName}>{d.label}</div>
                  <div className={styles.diffRange}>{d.range}</div>
                </div>
              ))}
            </div>

            <button className={styles.startBtn} onClick={() => navigate(`/game?mode=speedrun&d=${diff}`)}>START &#8594;</button>
          </>
        ) : (
          <div className={styles.proGate}>
            <span>Speedrun is a <strong>Pro</strong> feature.</span>
            <Link to="/upgrade" className={styles.proBtn}>Upgrade</Link>
          </div>
        )}
      </div>
    </div>
  );
}
