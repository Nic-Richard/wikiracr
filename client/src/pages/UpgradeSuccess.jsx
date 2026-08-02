import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import styles from './UpgradeSuccess.module.css';

export default function UpgradeSuccess() {
  return (
    <div className={styles.root}>
      <NetworkBackground />
      <div className={styles.content}>
        <div className={styles.icon}>&#10003;</div>
        <h1 className={styles.title}>You're Pro</h1>
        <p className={styles.sub}>Your subscription is active. Pro features are now unlocked.</p>
        <Link to="/menu" className={styles.btn}>GO TO MENU</Link>
      </div>
    </div>
  );
}
