import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import styles from './UpgradeSuccess.module.css';

export default function NotFound() {
  return (
    <div className={styles.root}>
      <NetworkBackground />
      <div className={styles.content}>
        <div className={styles.icon}>?</div>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.sub}>That link doesn't lead anywhere. It may be outdated or mistyped.</p>
        <Link to="/" className={styles.btn}>GO HOME</Link>
      </div>
    </div>
  );
}
