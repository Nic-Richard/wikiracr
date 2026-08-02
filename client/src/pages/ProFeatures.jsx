import { Link, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import NetworkBackground from '../components/NetworkBackground';
import NavMenu from '../components/NavMenu';
import ReportButton from '../components/ReportButton';
import GhostCards from '../components/GhostCards';
import { useMotion } from '../lib/MotionContext';
import { useMouseTilt } from '../lib/useMouseTilt';
import { useIsPro } from '../lib/useIsPro';
import styles from './ProFeatures.module.css';

const FEATURES = [
  { label: 'CUSTOM LOBBY',    path: '/custom-lobby',    desc: 'Up to 32 players, 5 modes, timeout control' },
  { label: 'HIGHER OR LOWER', path: '/higher-or-lower', desc: 'Guess which article gets more monthly views'     },
  { label: 'SPEEDRUN MODE',   path: '/speedrun',         desc: '5 pairs against the clock, ranked by best time'  },
];

const WIKI_SEQS = [
  [
    { title: 'Cleopatra',     body: 'Cleopatra VII Philopator was Queen of the Ptolemaic Kingdom of Egypt from 51 to 30 BC.', links: ['Julius Caesar', 'Ptolemaic dynasty', 'Ancient Egypt'], active: 0 },
    { title: 'Julius Caesar', body: 'Gaius Julius Caesar was a Roman general and statesman who played a critical role in Roman history.', links: ['Roman Republic', 'Music of ancient Rome', 'Latin'], active: 1 },
    { title: 'Music',         body: 'Music is the art of arranging sounds in time to create some combination of form, harmony, melody, and rhythm.', links: ['Radiohead', 'Jazz', 'Classical music'], active: 0 },
  ],
  [
    { title: 'Albert Einstein',       body: 'Albert Einstein was a German-born theoretical physicist widely considered one of the greatest scientists of all time.', links: ['Theory of relativity', 'Physics', 'Nobel Prize'], active: 0 },
    { title: 'Theory of relativity',  body: 'The theory of relativity encompasses two interrelated physics theories by Albert Einstein.', links: ['Black hole', 'Spacetime', 'Gravity'], active: 0 },
    { title: 'Black hole',            body: 'A black hole is a region of spacetime where gravity is so strong that nothing can escape once past the event horizon.', links: ['Stephen Hawking', 'Event horizon', 'Galaxy'], active: 0 },
  ],
  [
    { title: 'Vikings',  body: 'Vikings were Norse seafarers who explored Europe, the North Atlantic, and North America during the Viking Age.', links: ['Iceland', 'Norse mythology', 'Scandinavia'], active: 0 },
    { title: 'Iceland',  body: 'Iceland is a Nordic island nation characterised by volcanoes, geysers, hot springs and lava fields.', links: ['Volcano', 'Geothermal energy', 'Nordic countries'], active: 0 },
    { title: 'Volcano',  body: 'A volcano is a rupture in the crust of a planetary body that allows hot lava, volcanic ash, and gases to escape.', links: ['Lava', 'Magma', 'Eruption'], active: 0 },
  ],
];

export default function ProFeatures() {
  const { isLoaded } = useUser();
  const { enabled: motionEnabled } = useMotion();
  const tilt = useMouseTilt();

  const isPro = useIsPro();

  if (isLoaded && !isPro) return <Navigate to="/upgrade" replace />;

  const contentStyle = motionEnabled ? {
    transform:  `perspective(1200px) rotateX(${tilt.y * 0.6}deg) rotateY(${tilt.x * 0.6}deg)`,
    transition: 'transform 0.18s ease-out',
  } : {};

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motionEnabled} />
      <div className={styles.vignette} />

      <div className={styles.reportCorner}>
        <ReportButton context={{ page: 'pro-features' }} openUp />
      </div>

      <GhostCards sequences={WIKI_SEQS} tilt={tilt} motionEnabled={motionEnabled} />

      <div className={styles.fg}>
        <div className={styles.topBar}>
          <Link to="/" className="wordmark"><span className="w">Wiki</span><span className="r">Racr</span></Link>
          <div className={styles.topRight}>
            <NavMenu isPro={isPro} />
          </div>
        </div>

        <div className={styles.center}>
          <div className={styles.content} style={contentStyle}>
            <div className={styles.headerRow}>
              <Link to="/menu" className={styles.back}>&#8592; Back</Link>
              <div className={styles.proTag}>PRO</div>
            </div>
            <p className={styles.tagline}>Exclusive modes for subscribers.</p>
            <nav className={styles.menu}>
              {FEATURES.map(f => (
                <Link key={f.path} to={f.path} className={styles.opt}>
                  <span className={styles.optLabel}>{f.label}</span>
                  <span className={styles.optDesc}>{f.desc}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
