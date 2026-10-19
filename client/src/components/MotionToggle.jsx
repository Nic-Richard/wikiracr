import { useLocation } from 'react-router-dom';
import { useMotion } from '../lib/MotionContext';
import styles from './MotionToggle.module.css';

const HIDDEN_ON = ['/game', '/room/'];

export default function MotionToggle({ inline = false }) {
  const { enabled, toggle } = useMotion();
  const { pathname }        = useLocation();

  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  return (
    <button
      className={`${styles.btn} ${inline ? styles.inline : ''}`}
      onClick={toggle}
      title={enabled ? 'Disable motion effects' : 'Enable motion effects'}
      aria-pressed={enabled}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M5 5a10 10 0 0 1 14 14M19 5A10 10 0 0 0 5 19" /></svg>
      {enabled ? 'Motion on' : 'Motion off'}
    </button>
  );
}
