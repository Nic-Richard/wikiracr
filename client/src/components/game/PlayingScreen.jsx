import WikiArticle from '../WikiArticle';
import SettingsModal from '../SettingsModal';
import HintButton from '../HintButton';
import ReportButton from '../ReportButton';
import ChatPanel from '../ChatPanel';
import OpponentHUD from './OpponentHUD';
import { formatStandingValue } from '../../lib/modeDisplay';
import { calcScore } from '../../lib/scoring';
import { formatTime as fmt, normalizeTitle as nt } from '../../lib/format';
import styles from '../../pages/Game.module.css';

export default function PlayingScreen({
  pair,
  currentArticle,
  navHist,
  histIdx,
  clicks,
  elapsed,
  difficulty,
  isSolo,
  isSpeedrun,
  speedrunBankedSeconds,
  speedrunRoundNum,
  speedrunRoundsTotal,
  roomState,
  players,
  standings,
  socketId,
  mpMode,
  mpRoundNum,
  mpMaxRounds,
  now,
  sprintExpiresAt,
  checkingLink,
  linkRejected,
  skipCount,
  skipRequired,
  skipVoters,
  skipsExhausted,
  chatMessages,
  chatEnabled,
  settingsOpen,
  muted,
  goBack,
  goForward,
  handleLinkClick,
  voteSkip,
  giveUp,
  sendChat,
  toggleMute,
  toggleChat,
  openSettings,
  closeSettings,
}) {
  const breadcrumb = navHist.slice(Math.max(0, histIdx - 3), histIdx + 1);
  const opponents = players.filter(p => p.socketId !== socketId);
  const myPlayer = players.find(p => p.socketId === socketId);
  const iHaveGivenUp = !isSolo && myPlayer?.gaveUp;
  const iHaveFinished = !isSolo && myPlayer?.finished;
  const showsLiveScore = !isSpeedrun && (isSolo || ['classic', 'score', 'knockout'].includes(mpMode));
  const liveScore = showsLiveScore
    ? (iHaveFinished ? (myPlayer.score ?? 0) : calcScore(clicks, pair.pathLength, elapsed))
    : 0;

  return (
    <div className={styles.gameroot}>
      <div className={styles.hud}>
        <div className={styles.hudLeft}>
          <button className={styles.navBtn} onClick={goBack} disabled={histIdx <= 0}>&#8592;</button>
          <button className={styles.navBtn} onClick={goForward} disabled={histIdx >= navHist.length - 1}>&#8594;</button>
          <span className={styles.hudArticle}>{nt(currentArticle)}</span>
        </div>

        <div className={styles.hudInfoRow}>
          <div className={styles.hudCenter}>
            {!isSolo && roomState?.options?.ranked && (
              <span className={styles.hudRankedBadge}>RANKED</span>
            )}
            {isSpeedrun && (
              <span className={styles.hudRoundBadge}>ROUND {speedrunRoundNum}/{speedrunRoundsTotal}</span>
            )}
            {!isSolo && mpMode === 'knockout' && (
              <span className={styles.hudRoundBadge}>ROUND {mpRoundNum} &middot; {standings.filter(s => !s.eliminated).length || players.length} LEFT</span>
            )}
            {!isSolo && mpMode !== 'knockout' && (
              <span className={styles.hudRoundBadge}>ROUND {mpRoundNum}/{mpMaxRounds}</span>
            )}
            <span className={styles.hudStartChip}>{nt(pair.startTitle)}</span>
            <span className={styles.hudArrow}>&#8594;</span>
            <span className={styles.hudGoalChip}>{nt(pair.endTitle)}</span>
            <span className={styles.hudOptimal}>{pair.pathLength} optimal</span>
            <HintButton title={pair.endTitle} />
            <ReportButton context={{
              page: 'game',
              mode: isSolo ? (isSpeedrun ? 'speedrun' : 'solo') : mpMode,
              difficulty,
              pairId: pair.id,
              startTitle: pair.startTitle,
              endTitle: pair.endTitle,
              currentArticle,
            }} />
          </div>

          <div className={styles.hudRight}>
            {!isSolo && (
              <OpponentHUD
                opponents={opponents}
                standings={standings}
                players={players}
                mySocketId={socketId}
                mode={mpMode}
                now={now}
              />
            )}
            {!isSolo && (() => {
              const myStanding = standings.find(s => s.socketId === socketId);
              if (!myStanding) return null;
              return (
                <span className={
                  mpMode === 'knockout'
                    ? (myStanding.eliminated ? styles.oppOut : styles.oppHp)
                    : styles.oppWins
                }>{formatStandingValue(mpMode, myStanding)}</span>
              );
            })()}
            {showsLiveScore && (
              <>
                <span className={styles.hudLiveScore}>SCORE {liveScore.toLocaleString()}</span>
                <span className={styles.hudDivider} />
              </>
            )}
            <span className={styles.hudTimer}>{fmt(isSpeedrun ? speedrunBankedSeconds + elapsed : elapsed)}</span>
            <span className={styles.hudDivider} />
            <span className={styles.hudClicks}>{clicks} click{clicks !== 1 ? 's' : ''}</span>
            <span className={styles.hudDivider} />
            <button className={styles.cogBtn} title="Settings" onClick={openSettings}>&#9881;</button>
          </div>
        </div>
      </div>

      {!isSolo && sprintExpiresAt && sprintExpiresAt > now && (
        <div className={styles.sprintBanner}>
          {iHaveFinished
            ? 'You finished'
            : (players.length === 2
                ? `${players.find(p => p.finished)?.username || 'Your opponent'} finished`
                : 'Someone finished')
          } &middot; {Math.max(0, Math.ceil((sprintExpiresAt - now) / 1000))}s left
        </div>
      )}

      {checkingLink && (
        <div className={`${styles.sprintBanner} ${styles.linkStatusPill}`}>Checking link&hellip;</div>
      )}
      {linkRejected && (
        <div className={`${styles.sprintBanner} ${styles.linkStatusPillError}`}>That link isn't on this page, try again</div>
      )}

      <div className={styles.articleArea}>
        <WikiArticle
          title={currentArticle}
          goalTitle={pair.endTitle}
          onLinkClick={handleLinkClick}
        />
        {iHaveGivenUp && (
          <div className={styles.gaveUpOverlay}>
            <div className={styles.spinner} />
            <p className={styles.gaveUpText}>You gave up this round.</p>
            <p className={styles.gaveUpSub}>Waiting for the round to end...</p>
          </div>
        )}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.breadcrumb}>
          {breadcrumb.map((a, i) => (
            <span key={i} className={styles.breadcrumbItem}>
              {i > 0 && <span className={styles.breadcrumbArrow}>›</span>}
              <span className={`${styles.breadcrumbChip} ${i === breadcrumb.length - 1 ? styles.breadcrumbChipCurrent : ''}`}>
                {nt(a)}
              </span>
            </span>
          ))}
        </div>
        {!isSolo && (
          <button
            className={styles.skipBtn}
            onClick={voteSkip}
            disabled={iHaveFinished || skipVoters.includes(socketId) || skipsExhausted}
            title={iHaveFinished ? 'You already finished this round' : skipsExhausted ? 'No skips left this match' : 'Vote to skip this pair'}
          >
            {iHaveFinished ? 'SKIP' : skipsExhausted ? 'SKIP (0 left)' : skipCount > 0 ? `SKIP (${skipCount}/${skipRequired})` : 'SKIP'}
          </button>
        )}
        {!iHaveGivenUp && <button className={styles.giveUpBtn} onClick={giveUp}>Give Up</button>}
      </div>

      {!isSolo && chatEnabled && (
        <ChatPanel messages={chatMessages} mySocketId={socketId} onSend={sendChat} />
      )}

      {settingsOpen && (
        <SettingsModal
          muted={muted}
          onToggleMute={toggleMute}
          chatEnabled={chatEnabled}
          onToggleChat={toggleChat}
          showChat={!isSolo}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}
