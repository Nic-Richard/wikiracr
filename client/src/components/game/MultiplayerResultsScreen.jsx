import { Link } from 'react-router-dom';
import NetworkBackground from '../NetworkBackground';
import StandingsList from './StandingsList';
import Podium from './Podium';
import { formatStandingValue, isRowOut } from '../../lib/modeDisplay';
import { formatTime as fmt } from '../../lib/format';
import styles from '../../pages/Game.module.css';

export default function MultiplayerResultsScreen({
  results,
  myPlayer,
  displayScore,
  maxRounds,
  mySocketId,
  motion,
  isHost,
  onRematch,
}) {
  const mode = results.mode;
  const sortedPlayers = results.players;
  const iWonMatch = results.winnerSocketId === mySocketId;
  const optPath = results.pair?.optimalPath || [];
  const optClicks = results.pair?.optimalClicks ?? (optPath.length - 1);

  const scoreLabelByMode = {
    classic:  `rounds (of ${results.roundHistory?.length ?? maxRounds})`,
    score:    'total score',
    clicks:   'total clicks',
    speedrun: 'total time',
    knockout: myPlayer?.eliminated ? 'HP (eliminated)' : 'HP remaining',
  };
  const matchTitleByMode = {
    classic:  iWonMatch ? 'You win the match' : 'You lose the match',
    score:    iWonMatch ? 'You win on score' : 'You lose on score',
    clicks:   iWonMatch ? 'You win on efficiency' : 'You lose on efficiency',
    speedrun: iWonMatch ? 'You win on time' : 'You lose on time',
    knockout: iWonMatch ? 'You\'re the last one standing' : (myPlayer?.eliminated ? 'You were eliminated' : 'You lose the match'),
  };
  const classicTotalScore = p => mode === 'classic' ? `${Number(p.totalScore || 0).toLocaleString()} total pts` : null;
  const standingProps = {
    secondaryFn: classicTotalScore,
    winnerSocketId: results.winnerSocketId,
  };

  return (
    <div className={styles.resroot}>
      <NetworkBackground parallax={motion} />
      <div className={styles.reswrap}>
        <p className={styles.resLabel}>MATCH COMPLETE</p>
        <h2 className={styles.roundBannerTitle}>{matchTitleByMode[mode]}</h2>

        <div className={styles.scoreRow}>
          <span className={styles.scoreNum}>{mode === 'speedrun' ? fmt(displayScore) : displayScore.toLocaleString()}</span>
          <span className={styles.scorePts}>{scoreLabelByMode[mode]}</span>
        </div>

        {sortedPlayers.length > 1 && (
          <>
            <StandingsList
              items={sortedPlayers}
              valueFn={p => formatStandingValue(mode, p)}
              isOutFn={isRowOut}
              mySocketId={mySocketId}
              title="FINAL STANDINGS"
              {...standingProps}
            />
            <Podium
              items={sortedPlayers}
              valueFn={p => formatStandingValue(mode, p)}
              isOutFn={isRowOut}
              mySocketId={mySocketId}
              {...standingProps}
            />
          </>
        )}

        {myPlayer?.elo && myPlayer.elo.isPlacement && (
          <p className={styles.placementNote}>Placement match {myPlayer.elo.gamesPlayed}/5 complete</p>
        )}
        {myPlayer?.elo && !myPlayer.elo.isPlacement && (
          <p className={`${styles.eloDelta} ${myPlayer.elo.delta >= 0 ? styles.eloGain : styles.eloLoss}`}>
            {myPlayer.elo.delta >= 0 ? '+' : ''}{myPlayer.elo.delta} rating ({myPlayer.elo.before} &#8594; {myPlayer.elo.after})
          </p>
        )}

        <div className={styles.clickCompare}>
          <span className={styles.yourClicks}>{myPlayer?.clicks ?? 0} click{myPlayer?.clicks !== 1 ? 's' : ''}</span>
          <span className={styles.vsText}>vs</span>
          <span className={styles.optClicks}>{optClicks} optimal</span>
        </div>

        <div className={styles.resButtons}>
          {isHost && !myPlayer?.elo && (
            <button className={styles.resPrimary} onClick={onRematch}>REMATCH</button>
          )}
          <Link to="/menu" className={styles.resSecondary}>MENU</Link>
        </div>
      </div>
    </div>
  );
}
