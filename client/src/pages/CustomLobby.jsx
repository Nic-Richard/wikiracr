import { useState, useRef, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { connectSocket } from '../lib/socket';
import NetworkBackground from '../components/NetworkBackground';
import { useMotion } from '../lib/MotionContext';
import { DIFFICULTIES } from '../lib/difficulties';
import { useIsPro } from '../lib/useIsPro';
import styles from './CustomLobby.module.css';

const MODES = [
  { key: 'classic',  name: 'Classic',  tag: 'BEST OF N',  desc: 'Highest round score wins the round. First to a majority wins the match.' },
  { key: 'score',    name: 'Score',    tag: 'CUMULATIVE', desc: 'Same rounds, but it’s total score across all of them that decides the winner.' },
  { key: 'clicks',   name: 'Clicks',   tag: 'EFFICIENCY', desc: 'Fewest total clicks across all rounds wins.' },
  { key: 'speedrun', name: 'Speedrun', tag: 'PURE TIME',  desc: 'Lowest total time across all rounds wins. Any route, just be fast.' },
  { key: 'knockout', name: 'Knockout', tag: 'ELIMINATION', desc: 'Everyone starts with HP. Round score decides who is safe and how much damage the rest take. Last one standing wins.' },
];

const ROUND_OPTIONS = {
  classic:  [3, 5, 7, 9],
  score:    [1, 3, 5, 7, 9, 10],
  clicks:   [1, 3, 5, 7, 9, 10],
  speedrun: [1, 3, 5, 7, 9, 10],
};

const HP_OPTIONS   = [1500, 3000, 6000, 10000];
const IMMUNITY_OPTIONS = [10, 15, 20, 25, 30, 40];
const RAMP_OPTIONS = [
  { key: 0,  label: 'Off' },
  { key: 5,  label: 'Mild' },
  { key: 10, label: 'Moderate' },
  { key: 20, label: 'Aggressive' },
];
const TIMEOUTS = [
  { key: 0,   label: 'Untimed' },
  { key: 60,  label: '1 min' },
  { key: 120, label: '2 min' },
  { key: 180, label: '3 min' },
  { key: 300, label: '5 min' },
];
const SPRINT_OPTIONS = [
  { key: 30,  label: '30s' },
  { key: 60,  label: '1 min' },
  { key: 90,  label: '90s' },
  { key: 120, label: '2 min' },
];

export default function CustomLobby() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { enabled: motion } = useMotion();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [mode, setMode]             = useState('classic');
  const [rounds, setRounds]         = useState(5);
  const [difficulty, setDifficulty] = useState('random');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [timeout_, setTimeout_]     = useState(0);
  const [sprintSeconds, setSprintSeconds] = useState(60);
  const [hp, setHp]                 = useState(6000);
  const [immunityPercent, setImmunityPercent] = useState(20);
  const [damageRamp, setDamageRamp] = useState(5);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState(null);

  const isPro = useIsPro();

  useEffect(() => {
    if (!isLoaded || !isPro) return;
    let cancelled = false;

    async function connect() {
      const token = await getToken();
      if (cancelled) return;

      const userObj = { userId: user?.id || null, username: user?.username || user?.firstName || 'Player', isPro: true };
      socketRef.current = connectSocket(userObj, token);
    }

    connect();
    return () => { cancelled = true; };
  }, [isLoaded, isPro, user, getToken]);

  if (isLoaded && !isPro) return <Navigate to="/upgrade" replace />;

  function selectMode(key) {
    setMode(key);
    if (key !== 'knockout' && !ROUND_OPTIONS[key].includes(rounds)) {
      setRounds(5);
    }
  }

  async function createLobby() {
    setCreating(true);
    setError(null);
    const token = await getToken();
    const options = {
      mode,
      difficulty,
      timeout: timeout_,
      sprintSeconds,
      maxPlayers,
      ...(mode !== 'knockout' ? { rounds } : {}),
      ...(mode === 'knockout' ? { hp, immunityPercent, damageRampPercent: damageRamp } : {}),
    };
    socketRef.current?.emit('create-custom-room', { ...options, token }, ({ ok, state, error: err }) => {
      setCreating(false);
      if (!ok) { setError(err || 'Could not create lobby'); return; }
      navigate(`/room/${state.code}`);
    });
  }

  const activeMode = MODES.find(m => m.key === mode);

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motion} />
      <div className={styles.wrap}>
        <div className={styles.headerRow}>
          <p className={styles.tag}>PRO &middot; CUSTOM LOBBY</p>
          <Link to="/pro" className={styles.backLink}>&#8592; Back</Link>
        </div>
        <h1 className={styles.title}>Build your match</h1>
        <p className={styles.subtitle}>Pick a mode, tune the rules, invite up to 32 players.</p>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>GAME MODE</p>
          <div className={styles.modeGrid}>
            {MODES.map(m => (
              <button
                key={m.key}
                className={`${styles.modeCard} ${mode === m.key ? styles.modeCardSel : ''}`}
                onClick={() => selectMode(m.key)}
              >
                <span className={styles.modeTag}>{m.tag}</span>
                <span className={styles.modeName}>{m.name}</span>
                <span className={styles.modeDesc}>{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {mode !== 'knockout' && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>ROUNDS</p>
            <div className={styles.pillRow}>
              {ROUND_OPTIONS[mode].map(r => (
                <button key={r} className={`${styles.pill} ${rounds === r ? styles.pillSel : ''}`} onClick={() => setRounds(r)}>
                  {mode === 'classic' ? `Bo${r}` : r}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'knockout' && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>STARTING HP</p>
            <div className={styles.pillRow}>
              {HP_OPTIONS.map(h => (
                <button key={h} className={`${styles.pill} ${hp === h ? styles.pillSel : ''}`} onClick={() => setHp(h)}>
                  {h.toLocaleString()}
                </button>
              ))}
            </div>
            <p className={styles.hint}>Plays until one player is left standing (rounds aren't capped).</p>
          </div>
        )}

        {mode === 'knockout' && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>SAFETY THRESHOLD</p>
            <div className={styles.pillRow}>
              {IMMUNITY_OPTIONS.map(pct => (
                <button key={pct} className={`${styles.pill} ${immunityPercent === pct ? styles.pillSel : ''}`} onClick={() => setImmunityPercent(pct)}>
                  Top {pct}%
                </button>
              ))}
            </div>
            <p className={styles.hint}>That top slice of the field takes no damage each round. Everyone else takes damage based on their score gap from the safety line.</p>
          </div>
        )}

        {mode === 'knockout' && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>DAMAGE RAMP</p>
            <div className={styles.pillRow}>
              {RAMP_OPTIONS.map(r => (
                <button key={r.key} className={`${styles.pill} ${damageRamp === r.key ? styles.pillSel : ''}`} onClick={() => setDamageRamp(r.key)}>
                  {r.label}{r.key > 0 ? ` (+${r.key}%/rd)` : ''}
                </button>
              ))}
            </div>
            <p className={styles.hint}>Falling all the way from the safety score to 0 is worth up to 1,000 damage before ramp. Higher HP means a longer battle.</p>
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionLabel}>DIFFICULTY</p>
          <div className={`${styles.pillRow} ${styles.pillRowCenter}`}>
            {DIFFICULTIES.map(d => (
              <button key={d.key} className={`${styles.pill} ${difficulty === d.key ? styles.pillSel : ''}`} onClick={() => setDifficulty(d.key)}>
                {d.label} <span className={styles.pillSub}>{d.range}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>ROUND TIMEOUT</p>
          <div className={styles.pillRow}>
            {TIMEOUTS.map(t => (
              <button key={t.key} className={`${styles.pill} ${timeout_ === t.key ? styles.pillSel : ''}`} onClick={() => setTimeout_(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>SPRINT WINDOW</p>
          <p className={styles.sectionHint}>Once someone finishes, how long everyone else gets to catch up.</p>
          <div className={styles.pillRow}>
            {SPRINT_OPTIONS.map(s => (
              <button key={s.key} className={`${styles.pill} ${sprintSeconds === s.key ? styles.pillSel : ''}`} onClick={() => setSprintSeconds(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>MAX PLAYERS</p>
          <div className={styles.stepper}>
            <button className={styles.stepBtn} onClick={() => setMaxPlayers(n => Math.max(2, n - 1))}>&minus;</button>
            <span className={styles.stepVal}>{maxPlayers}</span>
            <button className={styles.stepBtn} onClick={() => setMaxPlayers(n => Math.min(32, n + 1))}>+</button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.createBtn} onClick={createLobby} disabled={creating}>
          {creating ? 'CREATING...' : 'CREATE LOBBY'}
        </button>
      </div>
    </div>
  );
}
