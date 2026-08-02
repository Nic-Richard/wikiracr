import { Link } from 'react-router-dom';
import NetworkBackground from '../NetworkBackground';
import ChatPanel from '../ChatPanel';
import SettingsModal from '../SettingsModal';
import styles from '../../pages/Game.module.css';

const MODE_LABELS = { classic: 'CLASSIC', score: 'SCORE', clicks: 'CLICKS', speedrun: 'SPEEDRUN', knockout: 'KNOCKOUT' };

export default function LobbyScreen({
  motion,
  roomState,
  mode,
  players,
  socketId,
  now,
  code,
  copyRoomCode,
  copyCodeLabel,
  isHost,
  kickPlayer,
  toggleReady,
  hostStartGame,
  lobbyError,
  settingsOpen,
  setSettingsOpen,
  muted,
  toggleMute,
  chatEnabled,
  toggleChat,
  chatMessages,
  sendChat,
}) {
  const isMatchmakingLobby = !!roomState?.options?.matchmaking;
  const lobbyAutoStartSeconds = isMatchmakingLobby && roomState?.lobbyAutoStartAt
    ? Math.max(0, Math.ceil((roomState.lobbyAutoStartAt - now) / 1000))
    : null;
  const myReady = players.find(p => p.socketId === socketId)?.ready;

  return (
    <div className={styles.lobby}>
      <NetworkBackground parallax={motion} />
      <div className={styles.lobbyInner}>
        {isMatchmakingLobby ? (
          <div className={styles.lobbyMatchTitle}>
            <span className={styles.lobbyCodeLabel}>{roomState?.options?.ranked ? 'Ranked match' : 'Quick match'}</span>
            <span className={styles.lobbyMatchFound}>Match found</span>
            <span className={styles.lobbyMatchSub}>Ready up, or the match starts in {lobbyAutoStartSeconds ?? 30}s</span>
          </div>
        ) : (
          <div className={styles.lobbyCodeRow}>
            <span className={styles.lobbyCodeLabel}>Room</span>
            <span className={styles.lobbyCodeVal}>{code}</span>
            <button className={styles.lobbyCopyBtn} onClick={copyRoomCode}>{copyCodeLabel}</button>
          </div>
        )}

        {roomState?.options && (
          <div className={styles.lobbyOptions}>
            <span className={styles.lobbyOptionBadge}>{MODE_LABELS[mode] || mode.toUpperCase()}</span>
            {mode === 'knockout'
              ? <span className={styles.lobbyOptionBadge}>{roomState.options.hp.toLocaleString()} HP</span>
              : <span className={styles.lobbyOptionBadge}>{mode === 'classic' ? `Bo${roomState.options.rounds}` : `${roomState.options.rounds} rounds`}</span>
            }
            {mode === 'knockout' && (
              <span className={styles.lobbyOptionBadge}>top {roomState.options.immunityPercent}% safe</span>
            )}
            {mode === 'knockout' && roomState.options.damageRampPercent > 0 && (
              <span className={styles.lobbyOptionBadge}>+{roomState.options.damageRampPercent}% dmg/rd</span>
            )}
            <span className={styles.lobbyOptionBadge}>{roomState.options.difficulty}</span>
            <span className={styles.lobbyOptionBadge}>{roomState.options.timeout ? `${roomState.options.timeout}s/round` : 'untimed'}</span>
            <span className={styles.lobbyOptionBadge}>{roomState.options.sprintSeconds}s sprint</span>
            <span className={styles.lobbyOptionBadge}>{players.length}/{roomState.options.maxPlayers} players</span>
          </div>
        )}

        <div className={styles.lobbyPlayers}>
          {players.map(p => (
            <div key={p.socketId} className={`${styles.lobbyPlayer} ${p.ready ? styles.lobbyPlayerReady : ''}`}>
              <span className={styles.lobbyPlayerName}>{p.username}</span>
              <div className={styles.lobbyPlayerRight}>
                {!isMatchmakingLobby && p.socketId === roomState?.hostSocketId && (
                  <span className={styles.hostBadge}>HOST</span>
                )}
                {!isMatchmakingLobby && isHost && p.socketId !== socketId && (
                  <button className={styles.kickBtn} onClick={() => kickPlayer(p.socketId)} title="Remove player" aria-label="Remove player">&#10005;</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {isMatchmakingLobby ? (
          <button className={styles.readyBtn} onClick={toggleReady}>
            {myReady ? 'READY...' : 'READY UP'}
          </button>
        ) : isHost
          ? <button className={styles.startBtn} onClick={hostStartGame}>START GAME</button>
          : (
            <button className={styles.readyBtn} onClick={toggleReady}>
              {myReady ? 'READY...' : 'READY UP'}
            </button>
          )
        }

        {lobbyError && <p className={styles.lobbyError}>{lobbyError}</p>}
        <Link to="/menu" className={styles.lobbyLeave}>Leave room</Link>
        <button className={styles.lobbySettingsBtn} onClick={() => setSettingsOpen(true)}>&#9881; Settings</button>
      </div>

      {chatEnabled && (
        <ChatPanel messages={chatMessages} mySocketId={socketId} onSend={sendChat} />
      )}

      {settingsOpen && (
        <SettingsModal
          muted={muted}
          onToggleMute={toggleMute}
          chatEnabled={chatEnabled}
          onToggleChat={toggleChat}
          showChat={true}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
