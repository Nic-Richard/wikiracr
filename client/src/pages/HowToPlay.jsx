import { Link } from 'react-router-dom';
import NetworkBackground from '../components/NetworkBackground';
import NavMenu from '../components/NavMenu';
import { useMotion } from '../lib/MotionContext';
import { useIsPro } from '../lib/useIsPro';
import styles from './LearnPage.module.css';

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do you play WikiRacr?',
      acceptedAnswer: { '@type': 'Answer', text: 'WikiRacr gives you a start article and a goal article. Read the page, choose links, and find your way to the goal article.' },
    },
    {
      '@type': 'Question',
      name: 'Does going back cost a click in WikiRacr?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. Every article jump counts as a click, including going back, so detours matter.' },
    },
    {
      '@type': 'Question',
      name: 'How is WikiRacr scored?',
      acceptedAnswer: { '@type': 'Answer', text: 'Solo rewards both efficient routes and fast finishes, fewer extra clicks and lower time both help your score. In Classic multiplayer, each round has a score winner, and winning enough rounds wins the match.' },
    },
    {
      '@type': 'Question',
      name: 'What is the fastest way to find a route between two Wikipedia articles?',
      acceptedAnswer: { '@type': 'Answer', text: 'Use broad pages as hubs. Countries, cities, years, genres, sports, universities, people, and events can connect unrelated topics quickly.' },
    },
  ],
};

const basics = [
  {
    title: 'Get your pair',
    body: 'Every round gives you a start article and a goal article. Your route begins on the start page and ends when you reach the goal.',
  },
  {
    title: 'Move by article links',
    body: 'Click links inside the Wikipedia article to move from page to page. Use the HUD find box when you want to scan the current page faster.',
  },
  {
    title: 'Watch your clicks',
    body: 'Every article jump counts as a click. Going back also costs a click, so detours matter.',
  },
  {
    title: 'Finish the round',
    body: 'Reach the goal article to lock in your path. In solo, you can compare your route against the shortest known path after the round.',
  },
];

const scoring = [
  {
    title: 'Solo scoring',
    body: 'Solo rewards both efficient routes and fast finishes. Fewer extra clicks and lower time both help your score.',
  },
  {
    title: 'Classic multiplayer',
    body: 'Each round has a score winner. In Classic, winning enough rounds wins the match.',
  },
  {
    title: 'Clicks mode',
    body: 'Clicks mode ignores score and rewards the lowest total click count across the match.',
    pro: true,
  },
  {
    title: 'Speedrun mode',
    body: 'Speedrun cares about total time. The route can be ugly if it gets you there fast.',
    pro: true,
  },
  {
    title: 'Score mode',
    body: 'Score mode adds your round scores together. Consistent clean rounds matter more than stealing one round.',
    pro: true,
  },
  {
    title: 'Knockout',
    body: 'Players start with HP. The top slice of the field is safe each round, and everyone else takes damage based on the gap from the safety score. Last player standing wins.',
    pro: true,
  },
];

const tips = [
  'Use broad pages as hubs. Countries, cities, years, genres, sports, universities, people, and events can connect unrelated topics quickly.',
  'Look for categories, locations, parent topics, and related people when a page feels like a dead end.',
  'Do not panic-click every blue link. A slightly slower good link beats a fast dead end.',
  'In multiplayer, decide whether the mode rewards speed, clicks, score, or survival before you choose risky links.',
];

export default function HowToPlay() {
  const isPro = useIsPro();
  const { enabled: motionEnabled } = useMotion();

  return (
    <div className={styles.root} data-route-scroll>
      <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
      <NetworkBackground parallax={motionEnabled} />
      <div className={styles.vignette} />

      <main className={styles.wrap}>
        <header className={styles.header}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <nav className={styles.headerLinks}>
            <Link to="/wiki-race" className={styles.topLink}>Wiki Racing</Link>
            <Link to="/menu" className={styles.topLink}>Play</Link>
            <NavMenu isPro={isPro} />
          </nav>
        </header>

        <section className={styles.hero}>
          <p className={styles.kicker}>How to play</p>
          <h1>Wikipedia racing rules.</h1>
          <p className={styles.intro}>
            WikiRacr gives you a start article and a goal article. Read the page, choose links, and find your way to the goal article.
          </p>
          <div className={styles.actions}>
            <Link to="/menu" className={styles.primaryBtn}>PLAY NOW</Link>
            <Link to="/daily" className={styles.secondaryBtn}>Daily Challenge</Link>
          </div>
        </section>

        <section className={styles.grid} aria-label="Basic WikiRacr rules">
          {basics.map((rule, index) => (
            <article key={rule.title} className={styles.card}>
              <div className={styles.number}>{index + 1}</div>
              <h2>{rule.title}</h2>
              <p>{rule.body}</p>
            </article>
          ))}
        </section>

        <section className={styles.panel}>
          <div>
            <p className={styles.kicker}>Modes and scoring</p>
            <h2>Know what the round rewards.</h2>
          </div>
          <div className={styles.detailGrid}>
            {scoring.map(item => (
              <article key={item.title} className={styles.detailItem}>
                <h3>{item.title}{item.pro && <span className={styles.proTag}>Pro</span>}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <p className={styles.panelFootnote}>Check the <Link to="/leaderboard">leaderboard</Link> to see how your results compare.</p>
        </section>

        <section className={styles.panel}>
          <div>
            <p className={styles.kicker}>Tips</p>
            <h2>How to find a good route.</h2>
          </div>
          <ul className={styles.modeList}>
            {tips.map(tip => <li key={tip}>{tip}</li>)}
          </ul>
        </section>
      </main>
    </div>
  );
}
