import ReportButton from './ReportButton';
import { useArticleZoom, ZOOM_LIMITS } from './WikiArticle';
import styles from './SettingsModal.module.css';

export default function SettingsModal({ muted, onToggleMute, chatEnabled, onToggleChat, showChat, showTextSize, report, onClose }) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">&times;</button>
        </div>

        {showTextSize && <TextSizeRow />}

        {onToggleMute && <div className={styles.row}>
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
        </div>}

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

        {report && (
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Report a problem</span>
              <span className={styles.rowSub}>A bad pair, a broken article or a bug</span>
            </div>
            <ReportButton context={report} />
          </div>
        )}
      </div>
    </div>
  );
}

function TextSizeRow() {
  const [zoom, setZoom] = useArticleZoom();
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>Article text size</span>
        <span className={styles.rowSub}>Pinch to zoom works too</span>
      </div>
      <div className={styles.stepper}>
        <button onClick={() => setZoom(value => value - ZOOM_LIMITS.step)} disabled={zoom <= ZOOM_LIMITS.min()} aria-label="Zoom article out">&minus;</button>
        <button onClick={() => setZoom(100)} aria-label="Reset article zoom">{zoom}%</button>
        <button onClick={() => setZoom(value => value + ZOOM_LIMITS.step)} disabled={zoom >= ZOOM_LIMITS.max} aria-label="Zoom article in">+</button>
      </div>
    </div>
  );
}
