import { useLocation } from 'react-router-dom';
import { useMotion } from '../lib/MotionContext';
import styles from './MotionToggle.module.css';

const HIDDEN_ON = ['/game', '/room/'];

export default function MotionToggle() {
  const { enabled, toggle } = useMotion();
  const { pathname }        = useLocation();

  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  return (
    <button
      className={styles.btn}
      onClick={toggle}
      title={enabled ? 'Disable motion effects' : 'Enable motion effects'}
    >
      {enabled ? '◎ Motion on' : '⊗ Motion off'}
    </button>
  );
}
