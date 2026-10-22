import { useEffect, useRef, useState } from 'react';
import Arrow from '../Arrow';
import HintButton from '../HintButton';
import { formatStandingValue, isRowOut } from '../../lib/modeDisplay';
import { normalizeTitle as nt } from '../../lib/format';
import styles from './RaceBar.module.css';

// Phone race header: where you are, where you're going, and the match.
export default function RaceBar({
  currentArticle,
  goalTitle,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  tags = [],
  timer,
  clicks,
  score,
  onFind,
  onSettings,
  match,
}) {
  return (
    <div className={styles.bar} data-native-hud>
      <div className={styles.navRow}>
        <button className={styles.navBtn} onClick={goBack} aria-label="Previous article" disabled={!canGoBack}><Arrow left /></button>
        <button className={styles.navBtn} onClick={goForward} aria-label="Next article" disabled={!canGoForward}><Arrow /></button>
        <span className={styles.article} title={nt(currentArticle)}>{nt(currentArticle)}</span>
        <span className={styles.clock}>
          {timer && <span className={styles.timer}>{timer}</span>}
          <span className={styles.clicks}>{clicks} click{clicks !== 1 ? 's' : ''}</span>
        </span>
        <button className={styles.iconBtn} onClick={onSettings} aria-label="Settings" title="Settings">&#9881;</button>
      </div>

      <div className={styles.goalRow}>
        <span className={styles.goal}>
          <span className={styles.goalLabel}>
            GOAL
            {tags.map(tag => <span key={tag.label} className={tag.gold ? styles.tagGold : styles.tag}>{tag.label}</span>)}
          </span>
          <span className={styles.goalTitle} title={nt(goalTitle)}>{nt(goalTitle)}</span>
        </span>
        {score != null && (
          <span className={styles.score}><span className={styles.scoreLabel}>SCORE</span>{score.toLocaleString()}</span>
        )}
        <HintButton title={goalTitle} />
        <button className={styles.iconBtn} onClick={onFind} aria-label="Find on this page" title="Find on this page">&#128269;</button>
      </div>

      {match && <MatchRow {...match} />}
    </div>
  );
}

function MatchRow({ mode, standings, players, mySocketId, now }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const rows = [
    ...standings,
    ...players.filter(p => !standings.some(s => s.socketId === p.socketId))
      .map(p => ({ socketId: p.socketId, username: p.username, roundWins: 0, totalScore: 0, totalClicks: 0, totalTimeSeconds: 0, hp: '-' })),
  ];
  const myIndex = rows.findIndex(s => s.socketId === mySocketId);
  const me = rows[myIndex];
  const others = players.filter(p => p.socketId !== mySocketId);
  const done = others.filter(p => p.finished).length;
  const away = others.filter(p => p.disconnected && !standings.find(s => s.socketId === p.socketId)?.eliminated).length;

  return (
    <div className={styles.matchRow} ref={boxRef}>
      {me && (
        <span className={styles.me}>
          <span className={styles.meLabel}>You</span>
          <span className={isRowOut(me) ? styles.valueOut : styles.value}>{formatStandingValue(mode, me)}</span>
          {rows.length > 1 && <span className={styles.rank}>{myIndex + 1} of {rows.length}</span>}
        </span>
      )}
      <button className={styles.rosterBtn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{others.length === 1 ? others[0].username : `${others.length} rivals`}</span>
        {done > 0 && <span className={styles.done}>{others.length === 1 ? 'finished' : done === others.length ? 'all done' : `${done} done`}</span>}
        {away > 0 && <span className={styles.away}>{away} away</span>}
        <span className={`${styles.caret} ${open ? styles.caretOpen : ''}`}><Arrow /></span>
      </button>

      {open && (
        <div className={styles.roster}>
          {rows.map((s, i) => {
            const live = players.find(p => p.socketId === s.socketId);
            const out = isRowOut(s);
            return (
              <div key={s.socketId} className={`${styles.rosterRow} ${s.socketId === mySocketId ? styles.rosterMe : ''} ${out ? styles.rosterOut : ''}`}>
                <span className={styles.rosterRank}>{i + 1}</span>
                <span className={styles.rosterName}>{s.username}{s.socketId === mySocketId ? ' (you)' : ''}</span>
                {!out && live?.disconnected && (
                  <span className={styles.away}>
                    {live.graceExpiresAt ? `Forfeit in ${Math.max(0, Math.ceil((live.graceExpiresAt - now) / 1000))}s` : 'AWAY'}
                  </span>
                )}
                {live && <span className={styles.rosterClicks}>{live.clicks ?? 0} clicks</span>}
                {live?.gaveUp ? <span className={styles.gaveUp}>&#10005;</span> : live?.finished ? <span className={styles.check}>&#10003;</span> : null}
                <span className={out ? styles.valueOut : styles.value}>{formatStandingValue(mode, s)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
