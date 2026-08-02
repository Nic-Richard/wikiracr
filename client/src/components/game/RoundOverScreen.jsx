import NetworkBackground from '../NetworkBackground';
import StandingsList from './StandingsList';
import Podium from './Podium';
import ShortestPath from './ShortestPath';
import { formatStandingValue, isRowOut } from '../../lib/modeDisplay';
import styles from '../../pages/Game.module.css';

export default function RoundOverScreen({
  mode,
  maxRounds,
  roundBanner,
  standings,
  eliminatedThisRound,
  mySocketId,
  motion,
  continueCount,
  continueRequired,
  iHaveContinued,
  onContinue,
}) {
  const isDraw = !roundBanner.winnerSocketId;
  const winnerName = roundBanner.results.find(r => r.socketId === roundBanner.winnerSocketId)?.username;
  const iWon = roundBanner.winnerSocketId === mySocketId;
  const roundTitleByMode = {
    classic:  isDraw ? 'Draw, no clear winner' : iWon ? 'You win the round' : `${winnerName} wins the round`,
    score:    isDraw ? 'Draw this round' : iWon ? 'You led this round' : `${winnerName} led this round`,
    clicks:   isDraw ? 'Draw this round' : iWon ? 'You were most efficient' : `${winnerName} was most efficient`,
    speedrun: isDraw ? 'Draw this round' : iWon ? 'You were fastest' : `${winnerName} was fastest`,
    knockout: isDraw ? 'No one took the lead' : iWon ? 'You dealt the damage' : `${winnerName} dealt the damage`,
  };
  const eliminatedNames = eliminatedThisRound
    .map(id => roundBanner.results.find(r => r.socketId === id)?.username)
    .filter(Boolean);
  const scoreBySocket = new Map((roundBanner.results || []).map(r => [r.socketId, r.score || 0]));
  const standingsWithScores = standings.map(s => ({ ...s, score: scoreBySocket.get(s.socketId) ?? s.score ?? 0 }));
  const classicRoundScore = s => mode === 'classic' ? `${Number(s.score || 0).toLocaleString()} pts this round` : null;
  const standingProps = {
    secondaryFn: classicRoundScore,
    winnerSocketId: roundBanner.winnerSocketId,
  };

  return (
    <div className={styles.resroot}>
      <NetworkBackground parallax={motion} />
      <div className={styles.reswrap}>
        <p className={styles.resLabel}>
          {mode === 'knockout' ? `ROUND ${roundBanner.roundNum}` : `ROUND ${roundBanner.roundNum} OF ${maxRounds}`}
        </p>
        <h2 className={styles.roundBannerTitle}>{roundTitleByMode[mode]}</h2>

        {eliminatedNames.length > 0 && (
          <p className={styles.eliminationText}>
            {eliminatedNames.join(', ')} {eliminatedNames.length === 1 ? 'has' : 'have'} been eliminated
          </p>
        )}

        {mode === 'knockout' && (
          <div className={styles.damageBoard}>
            {roundBanner.results.map(r => {
              const f = r.lastDamageFormula;
              const rampPct = f ? Math.round((f.ramp - 1) * 100) : 0;
              return (
                <div key={r.socketId} className={`${styles.damageCard} ${r.lastDamage > 0 ? styles.damageHit : styles.damageSafe}`}>
                  <div className={styles.damageTop}>
                    <span className={styles.damageName}>{r.username}</span>
                    <span className={styles.damageHp}>{r.hp.toLocaleString()} HP</span>
                  </div>
                  <div className={styles.damageAmount}>{r.lastDamage > 0 ? `-${r.lastDamage.toLocaleString()}` : 'SAFE'}</div>
                  {f && r.lastDamage > 0 && (
                    <p className={styles.damageFormula}>
                      {f.gap.toLocaleString()} below safety ÷ {Math.max(1, f.cutoffScore || 0).toLocaleString()} safety score × {(f.maxDamage || 1000).toLocaleString()} max damage{rampPct ? ` × +${rampPct}% ramp` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <StandingsList
          items={standingsWithScores}
          valueFn={s => formatStandingValue(mode, s)}
          isOutFn={isRowOut}
          mySocketId={mySocketId}
          {...standingProps}
        />
        <ShortestPath pathTitles={roundBanner.pair?.optimalPath} />
        <Podium
          items={standingsWithScores}
          valueFn={s => formatStandingValue(mode, s)}
          isOutFn={isRowOut}
          mySocketId={mySocketId}
          {...standingProps}
        />
        <div className={styles.continueRow}>
          <button className={styles.continueBtn} onClick={onContinue} disabled={iHaveContinued}>
            {iHaveContinued ? 'WAITING FOR OTHERS' : 'CONTINUE'}
          </button>
          {continueRequired > 0 && <span className={styles.continueProgress}>{continueCount}/{continueRequired} ready</span>}
        </div>
      </div>
    </div>
  );
}
