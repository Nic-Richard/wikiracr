import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import NavMenu from '../components/NavMenu';
import { useMotion } from '../lib/MotionContext';
import { useIsPro } from '../lib/useIsPro';
import styles from './Home.module.css';

const PAIRS = [
  { start: 'Cleopatra',         end: 'Radiohead',    clicks: 3 },
  { start: 'Great White Shark', end: 'Piano',        clicks: 2 },
  { start: 'Moon landing',      end: 'Taylor Swift', clicks: 3 },
  { start: 'Aristotle',         end: 'Bitcoin',      clicks: 3 },
  { start: 'Black hole',        end: 'Pizza',        clicks: 2 },
  { start: 'Napoleon',          end: 'Surfing',      clicks: 2 },
];

export default function Home() {
  const isPro = useIsPro();
  const { enabled: motionEnabled } = useMotion();
  const [pairIdx, setPairIdx] = useState(0);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPairIdx(i => (i + 1) % PAIRS.length);
        setFading(false);
      }, 420);
    }, 4800);
    return () => clearInterval(id);
  }, []);

  const pair = PAIRS[pairIdx];

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motionEnabled} />

      <nav className={styles.nav}>
        <Link to="/" className="wordmark">
          <span className="w">Wiki</span><span className="r">Racr</span>
        </Link>
        <div className={styles.navRight}>
          <NavMenu isPro={isPro} />
        </div>
      </nav>

      <main className={styles.hero}>
        <div className={styles.glow} />
        <h1 className={styles.logo}>
          <span className="w">Wiki</span><span className="r">Racr</span>
        </h1>
        <p className={styles.sub}>
          Race through Wikipedia from a start article to a goal article by clicking links.
          Fewer clicks, faster times, and smarter routes earn the win.
        </p>

        <div className={`${styles.pairWrap} ${fading ? styles.fading : ''}`}>
          <div className={styles.chain}>
            <span className={`${styles.chip} ${styles.chipStart}`}>{pair.start}</span>
            {Array.from({ length: pair.clicks - 1 }).map((_, i) => (
              <span key={i}>
                <span className={styles.arrow}>&#8594;</span>
                <span className={`${styles.chip} ${styles.chipMid}`}>???</span>
              </span>
            ))}
            <span className={styles.arrow}>&#8594;</span>
            <span className={`${styles.chip} ${styles.chipEnd}`}>{pair.end}</span>
          </div>
          <p className={styles.pairNote}>
            <b>{pair.clicks} click{pair.clicks !== 1 ? 's' : ''}</b> to get there
          </p>
        </div>

        <Link to="/menu" className={styles.playBtn}>PLAY NOW</Link>
        <p className={styles.guestNote}>No account needed to play</p>

        <section className={styles.explain} aria-label="What is WikiRacr?">
          <article className={styles.explainCard}>
            <h2>Every pair is curated</h2>
            <p>Pairs are pre-generated with difficulty tiers based on optimal path length and article popularity. Finish a round and you can see your route next to the path WikiRacr found.</p>
          </article>
          <article className={styles.explainCard}>
            <h2>More tools than the classic game</h2>
            <p>Back and forward buttons, a search bar to scan the current article, and a hint that pulls the goal article's intro. Build them into your winning strategy.</p>
          </article>
          <article className={styles.explainCard}>
            <h2>Scoring that rewards both</h2>
            <p>Your route efficiency and your time both count toward the score. A clean slow path and a messy fast one can land in the same place. You need both to win.</p>
          </article>
          <article className={styles.explainCard}>
            <h2>Custom lobbies with 5 modes and up to 32 players</h2>
            <p>Classic, Score, Clicks, Speedrun, and Knockout, each with its own win condition. Set the difficulty, round count, and timeout. Pro subscribers can create lobbies and invite anyone to join.</p>
          </article>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link to="/" className={`${styles.footerBrand} wordmark`}>
          <span className="w">Wiki</span><span className="r">Racr</span>
        </Link>
        <p className={styles.betaNote}>WikiRacr is a solo project, actively developed. Feedback welcome.</p>
        <div className={styles.footerLinks}>
          <Link to="/wiki-race" className={styles.footerLink}>Wiki Racing</Link>
          <Link to="/how-to-play" className={styles.footerLink}>How to Play</Link>
          <Link to="/leaderboard" className={styles.footerLink}>Leaderboard</Link>
          <Link to="/daily" className={styles.footerLink}>Daily</Link>
          <span className={styles.footerLink}>Uses Wikipedia and Wikimedia data</span>
          <Link to="/terms" className={styles.footerLink}>Terms</Link>
          <Link to="/privacy" className={styles.footerLink}>Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
