import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DIFFICULTIES } from '../lib/difficulties';
import { formatTime as fmt } from '../lib/format';
import { RANK_CLASS } from '../lib/rankDisplay';
import styles from './Leaderboard.module.css';

export default function Leaderboard() {
  const [tab, setTab]               = useState('daily');
  const [speedrunDiff, setSpeedrunDiff] = useState('random');
  const [board, setBoard]           = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    let url = '/api/leaderboard/daily';
    if (tab === 'elo') url = '/api/leaderboard/elo';
    if (tab === 'speedrun') url = `/api/leaderboard/speedrun?difficulty=${speedrunDiff}`;

    fetch(url)
      .then(r => r.json())
      .then(d => setBoard(d.leaderboard || []))
      .catch(() => setBoard([]))
      .finally(() => setLoading(false));
  }, [tab, speedrunDiff]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
        <h1 className={styles.title}>Leaderboards</h1>
        <Link to="/menu" className={styles.back}>&#8592; Back</Link>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'daily' ? styles.tabSel : ''}`} onClick={() => setTab('daily')}>DAILY</button>
        <button className={`${styles.tab} ${tab === 'elo' ? styles.tabSel : ''}`} onClick={() => setTab('elo')}>1V1 RATING</button>
        <button className={`${styles.tab} ${tab === 'speedrun' ? styles.tabSel : ''}`} onClick={() => setTab('speedrun')}>SPEEDRUN</button>
      </div>

      {tab === 'speedrun' && (
        <div className={styles.diffTabs}>
          {DIFFICULTIES.map(d => (
            <button
              key={d.key}
              className={`${styles.diffTab} ${speedrunDiff === d.key ? styles.diffTabSel : ''}`}
              onClick={() => setSpeedrunDiff(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.list}>
        {loading && <p className={styles.empty}>Loading...</p>}

        {!loading && board.length === 0 && tab === 'daily'    && <p className={styles.empty}>No daily results yet.</p>}
        {!loading && board.length === 0 && tab === 'elo'      && <p className={styles.empty}>No rated matches yet. Play a 1v1 to get on the board.</p>}
        {!loading && board.length === 0 && tab === 'speedrun' && <p className={styles.empty}>No speedrun times yet for this difficulty.</p>}

        {!loading && tab === 'daily' && board.map((row, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.rank}>#{i + 1}</span>
            <span className={styles.name}>{row.username}</span>
            <span className={styles.clicks}>{row.clicks} clicks</span>
            {row.time_seconds > 0 && <span className={styles.score}>{fmt(row.time_seconds)}</span>}
          </div>
        ))}

        {!loading && tab === 'elo' && board.map((row, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.rank}>#{i + 1}</span>
            <span className={`${styles.rankBadge} ${styles[RANK_CLASS[row.rank]] || ''}`}>{row.rank}</span>
            <span className={styles.name}>{row.username}</span>
            <span className={styles.clicks}>{row.wins}W&ndash;{row.losses}L</span>
            <span className={styles.score}>{row.elo}</span>
          </div>
        ))}

        {!loading && tab === 'speedrun' && board.map((row, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.rank}>#{i + 1}</span>
            <span className={styles.name}>{row.username}</span>
            <span className={styles.clicks}>{row.clicks} clicks</span>
            <span className={styles.score}>{fmt(row.total_seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
