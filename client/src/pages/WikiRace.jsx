import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import NavMenu from '../components/NavMenu';
import { useMotion } from '../lib/MotionContext';
import { useIsPro } from '../lib/useIsPro';
import styles from './LearnPage.module.css';

const features = [
  {
    title: 'Race through Wikipedia',
    body: 'Start on one article, follow links inside Wikipedia pages, and try to reach the target with a clean route.',
  },
  {
    title: 'Play solo or with friends',
    body: 'Practice alone, race a friend with a room code, or use matchmaking when you want a live opponent.',
  },
  {
    title: 'Compete daily',
    body: 'The Daily Challenge gives everyone the same pair, so the leaderboard comes down to route choice and execution.',
  },
];

export default function WikiRace() {
  const isPro = useIsPro();
  const { enabled: motionEnabled } = useMotion();

  return (
    <div className={styles.root} data-route-scroll>
      <NetworkBackground parallax={motionEnabled} />
      <div className={styles.vignette} />

      <main className={styles.wrap}>
        <header className={styles.header}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <nav className={styles.headerLinks}>
            <Link to="/how-to-play" className={styles.topLink}>How to Play</Link>
            <Link to="/leaderboard" className={styles.topLink}>Leaderboard</Link>
            <NavMenu isPro={isPro} />
          </nav>
        </header>

        <section className={styles.hero}>
          <p className={styles.kicker}>Wiki racing online</p>
          <h1>Play competitive Wikipedia racing.</h1>
          <p className={styles.intro}>
            WikiRacr is a Wikipedia navigation game where you move from a start article to a goal article by choosing links inside each page.
          </p>
          <div className={styles.actions}>
            <Link to="/menu" className={styles.primaryBtn}>START RACING</Link>
            <Link to="/how-to-play" className={styles.secondaryBtn}>How it works</Link>
          </div>
        </section>

        <section className={styles.grid} aria-label="WikiRacr features">
          {features.map(feature => (
            <article key={feature.title} className={styles.card}>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className={styles.panel}>
          <div>
            <p className={styles.kicker}>What is wiki racing?</p>
            <h2>A link-based route challenge.</h2>
          </div>
          <div>
            <p>
              Wiki racing is a game where players navigate between Wikipedia articles by clicking links. The challenge is finding useful connections between topics and reaching the goal before your route gets too long.
            </p>
            <p>
              The format goes back to link-clicking challenges from the 2000s, and it's traditionally come down to one of two things: fewest clicks, or fastest time. WikiRacr keeps both in play. Every round scores your route and your speed together, so a fast messy path and a slow clean one can both come out on top.
            </p>
          </div>
        </section>

        <section className={styles.panelCta}>
          <div>
            <h2>Ready to find the route?</h2>
            <p>Play a solo round in seconds, jump into multiplayer from the menu, or try today's <Link to="/daily">Daily Challenge</Link>.</p>
          </div>
          <Link to="/menu" className={styles.primaryBtn}>PLAY NOW</Link>
        </section>
      </main>
    </div>
  );
}
