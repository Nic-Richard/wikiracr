import Arrow from '../Arrow';
import { normalizeTitle as nt } from '../../lib/format';
import styles from '../../pages/Game.module.css';

export default function ShortestPath({ pathTitles, label = 'WIKIRACR FOUND', formatTitle = nt }) {
  if (!pathTitles || pathTitles.length === 0) return null;
  return (
    <div className={styles.shortestPathWrap}>
      {label && <p className={styles.shortestPathLabel}>{label}</p>}
      <div className={styles.shortestPathRow}>
        {pathTitles.map((t, i) => {
          const isFirst = i === 0;
          const isLast  = i === pathTitles.length - 1;
          return (
            <span key={i} className={styles.shortestPathItem}>
              {i > 0 && <span className={styles.shortestPathArrow}><Arrow /></span>}
              <span className={`${styles.shortestPathChip} ${isFirst ? styles.pathChipStart : isLast ? styles.pathChipEnd : ''}`}>
                {formatTitle(t)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
