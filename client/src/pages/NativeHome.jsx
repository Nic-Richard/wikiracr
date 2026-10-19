import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser, SignInButton } from '../lib/auth';
import { useIsPro } from '../lib/useIsPro';
import { DIFFICULTIES } from '../lib/difficulties';
import styles from './NativeHome.module.css';

export default function NativeHome() {
  const { user, isLoaded } = useUser();
  const pro = useIsPro();
  const [difficulty, setDifficulty] = useState('easy');
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
      <Link to="/account" className={styles.player}>{user?.imageUrl ? <img src={user.imageUrl} alt="" /> : <span className={styles.playerDot} />}{user?.username || user?.firstName || 'Guest'}</Link>
    </header>
    <section className={styles.intro}>
      <p className={styles.eyebrow}>FOLLOW YOUR CURIOSITY</p>
      <h1>Every link<br />is a way forward.</h1>
      <p>Two articles. One race.<br />Find your way through Wikipedia.</p>
      <div className={styles.example} aria-hidden="true"><span>Moon landing</span><span className={styles.arrow}>↗</span><span className={styles.destination}>Pizza</span></div>
    </section>
    <section className={styles.solo} aria-labelledby="solo-title">
      <div className={styles.sectionHead}><h2 id="solo-title">A race of your own</h2><span>SOLO</span></div>
      <label className={styles.difficulty}>Difficulty<select value={difficulty} onChange={event => setDifficulty(event.target.value)}>{DIFFICULTIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <Link className={styles.primary} to={`/game?d=${difficulty}`}>Start racing <span aria-hidden="true">↗</span></Link>
      <p>No account needed. Take as many turns as you like.</p>
    </section>
    <section className={styles.modes} aria-label="More ways to play">
      <Link className={`${styles.mode} ${styles.daily}`} to="/daily"><span className={styles.number}>01</span><h2>Daily challenge</h2><p>One route for everyone.<br />Make today’s run count.</p><span className={styles.modeAction}>Take the challenge ↗</span></Link>
      <Link className={styles.mode} to="/menu?panel=multi"><span className={styles.number}>02</span><h2>Race together</h2><p>Find an opponent or<br />create a room for friends.</p><span className={styles.modeAction}>Multiplayer ↗</span></Link>
    </section>
    <div className={styles.quickLinks}><Link to="/menu?panel=join">Join with a code <span>→</span></Link><Link to="/menu?panel=ranked">Ranked racing <span>→</span></Link></div>
    {pro && <section className={styles.proModes} aria-label="Pro modes"><h2>Your Pro modes</h2><Link to="/speedrun">Speedrun <span>→</span></Link><Link to="/higher-or-lower">Higher or Lower <span>→</span></Link><Link to="/custom-lobby">Custom lobby <span>→</span></Link></section>}
    {isLoaded && !user && <section className={styles.signIn}><div><h2>Keep your place.</h2><p>Sign in to save scores, build a streak and race for a ranking.</p></div><SignInButton><button>Sign in</button></SignInButton></section>}
    <footer className={styles.footer}><Link to="/how-to-play">How to play</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></footer>
  </main>;
}
