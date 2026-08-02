import styles from './SettingsModal.module.css';

export default function SettingsModal({ muted, onToggleMute, chatEnabled, onToggleChat, showChat, onClose }) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">&times;</button>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>Sound effects</span>
            <span className={styles.rowSub}>Mute in-game sounds</span>
          </div>
          <button
            className={`${styles.switch} ${!muted ? styles.switchOn : ''}`}
            onClick={onToggleMute}
            aria-pressed={!muted}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>

        {showChat && (
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>In-game chat</span>
              <span className={styles.rowSub}>Show the chat panel</span>
            </div>
            <button
              className={`${styles.switch} ${chatEnabled ? styles.switchOn : ''}`}
              onClick={onToggleChat}
              aria-pressed={chatEnabled}
            >
              <span className={styles.switchKnob} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
