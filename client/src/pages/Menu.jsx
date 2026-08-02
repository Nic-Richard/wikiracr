import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, useUser, useAuth } from '@clerk/clerk-react';
import { connectSocket } from '../lib/socket';
import { useMotion } from '../lib/MotionContext';
import { useMouseTilt } from '../lib/useMouseTilt';
import { useIsPro } from '../lib/useIsPro';
import { DIFFICULTIES } from '../lib/difficulties';
import { RANK_CLASS } from '../lib/rankDisplay';
import NavMenu from '../components/NavMenu';
import ReportButton from '../components/ReportButton';
import NetworkBackground from '../components/NetworkBackground';
import GhostCards from '../components/GhostCards';
import styles from './Menu.module.css';

const WIKI_SEQS = [
  [
    { title: 'Cleopatra',     body: 'Cleopatra VII Philopator was Queen of the Ptolemaic Kingdom of Egypt from 51 to 30 BC.', links: ['Julius Caesar', 'Ptolemaic dynasty', 'Ancient Egypt'], active: 0 },
    { title: 'Julius Caesar', body: 'Gaius Julius Caesar was a Roman general and statesman who played a critical role in Roman history.', links: ['Roman Republic', 'Music of ancient Rome', 'Latin'], active: 1 },
    { title: 'Music',         body: 'Music is the art of arranging sounds in time to create some combination of form, harmony, melody, and rhythm.', links: ['Radiohead', 'Jazz', 'Classical music'], active: 0 },
  ],
  [
    { title: 'Moon landing',  body: 'A moon landing is the arrival of a spacecraft on the surface of the Moon, including both crewed and robotic missions.', links: ['NASA', 'Apollo program', 'Neil Armstrong'], active: 0 },
    { title: 'NASA',          body: 'The National Aeronautics and Space Administration is an independent agency of the US federal government.', links: ['United States', 'Italy', 'Astronaut'], active: 1 },
    { title: 'Italy',         body: 'Italy, officially the Italian Republic, is a country in Southern and Central Europe consisting of a peninsula.', links: ['Pizza', 'Rome', 'Italian language'], active: 0 },
  ],
  [
    { title: 'Napoleon',        body: 'Napoleon Bonaparte was a French military commander and political leader who rose to prominence during the French Revolution.', links: ['France', 'French Revolution', 'Military history'], active: 0 },
    { title: 'France',          body: 'France, officially the French Republic, is a country in Western Europe. Its capital Paris is one of the great cultural centres of the world.', links: ['Paris', 'Music of France', 'French cuisine'], active: 1 },
    { title: 'Music of France', body: 'The music of France reflects a diverse cultural heritage spanning folk traditions, classical music, and contemporary popular styles.', links: ['Jazz', 'Chanson', 'Electronic music'], active: 0 },
  ],
  [
    { title: 'Dinosaur',  body: 'Dinosaurs are a diverse group of reptiles that first appeared during the Triassic period and dominated terrestrial ecosystems for over 165 million years.', links: ['Extinction', 'Asteroid', 'Fossil'], active: 1 },
    { title: 'Asteroid',  body: 'An asteroid is a minor planet -- a rocky, airless body orbiting the Sun. Most are found in the asteroid belt between Mars and Jupiter.', links: ['Moon', 'Solar System', 'NASA'], active: 0 },
    { title: 'Moon',      body: 'The Moon is Earth\'s only natural satellite. It is the fifth largest satellite in the Solar System and the largest relative to its parent planet.', links: ['Neil Armstrong', 'Gravity', 'Apollo program'], active: 0 },
  ],
  [
    { title: 'William Shakespeare', body: 'William Shakespeare was an English playwright, poet, and actor, widely regarded as the greatest writer in the English language.', links: ['Globe Theatre', 'Hamlet', 'Sonnets'], active: 0 },
    { title: 'Globe Theatre',       body: 'The Globe Theatre was a theatre in London associated with William Shakespeare. It was built in 1599 by Shakespeare\'s playing company.', links: ['London', 'Theatre', 'Architecture'], active: 0 },
    { title: 'London',              body: 'London is the capital and largest city of England and the United Kingdom, situated on the River Thames in south-east England.', links: ['Thames', 'Big Ben', 'United Kingdom'], active: 0 },
  ],
  [
    { title: 'Albert Einstein',       body: 'Albert Einstein was a German-born theoretical physicist who is widely considered one of the greatest and most influential scientists of all time.', links: ['Theory of relativity', 'Physics', 'Nobel Prize'], active: 0 },
    { title: 'Theory of relativity', body: 'The theory of relativity usually encompasses two interrelated physics theories by Albert Einstein: special relativity and general relativity.', links: ['Black hole', 'Spacetime', 'Gravity'], active: 0 },
    { title: 'Black hole',            body: 'A black hole is a region of spacetime where gravity is so strong that nothing, not even light or other electromagnetic waves, can escape once past the event horizon.', links: ['Stephen Hawking', 'Event horizon', 'Galaxy'], active: 0 },
  ],
  [
    { title: 'DNA',       body: 'Deoxyribonucleic acid is a polymer composed of two polynucleotide chains that coil around each other to form a double helix, carrying genetic instructions.', links: ['Gene', 'Evolution', 'Genetics'], active: 1 },
    { title: 'Evolution', body: 'Evolution is the change in heritable characteristics of biological populations over successive generations, the fundamental process driving the diversity of life.', links: ['Charles Darwin', 'Natural selection', 'Species'], active: 0 },
    { title: 'Charles Darwin', body: 'Charles Robert Darwin was an English naturalist, geologist, and biologist best known for his contributions to evolutionary biology.', links: ['Galapagos Islands', 'On the Origin of Species', 'Natural selection'], active: 2 },
  ],
  [
    { title: 'Vikings',  body: 'Vikings were Norse seafarers who, during the Viking Age, explored Europe, the North Atlantic, and North America, trading and settling across vast distances.', links: ['Iceland', 'Norse mythology', 'Scandinavia'], active: 0 },
    { title: 'Iceland',  body: 'Iceland is a Nordic island nation in the North Atlantic Ocean. It is characterised by its dramatic landscape with volcanoes, geysers, hot springs and lava fields.', links: ['Volcano', 'Geothermal energy', 'Nordic countries'], active: 0 },
    { title: 'Volcano',  body: 'A volcano is a rupture in the crust of a planetary-mass object that allows hot lava, volcanic ash, and gases to escape from a magma chamber below the surface.', links: ['Lava', 'Magma', 'Eruption'], active: 0 },
  ],
];

export default function Menu() {
  const navigate  = useNavigate();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const socketRef = useRef(null);

  const [ctx, setCtx]           = useState('main');
  const [diff, setDiff]         = useState('easy');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinErr, setJoinErr]   = useState(false);
  const [copyLabel, setCopy]    = useState('Copy code');
  const [searching, setSearching] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [rankedError, setRankedError] = useState(null);
  const [myElo, setMyElo] = useState(null);

  const isPro = useIsPro();
  const { enabled: motionEnabled } = useMotion();
  const tilt = useMouseTilt();

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    async function connect() {
      const token = user ? await getToken() : null;
      if (cancelled) return;

      const userObj = { userId: user?.id || null, username: user?.username || user?.firstName || 'Guest', isPro };
      const socket  = connectSocket(userObj, token);
      socketRef.current = socket;

      socket.on('match-found', ({ code }) => {
        navigate(`/room/${code}`);
      });
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.off('match-found');
    };
  }, [isLoaded, user, isPro, getToken, navigate]);

  function go(panel) {
    setCtx(panel);
    if (panel === 'ranked' && user) {
      getToken().then(token =>
        fetch('/api/me/elo', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(setMyElo)
          .catch(() => setMyElo(null))
      );
    }
  }

  function handleQuickMatch() {
    socketRef.current?.emit('find-match', {}, ({ ok, searching: s }) => {
      if (ok) { setSearching(true); setSearchSeconds(0); }
    });
  }

  function handleRankedMatch() {
    socketRef.current?.emit('find-ranked-match', {}, ({ ok, searching: s, error }) => {
      if (ok) { setSearching(true); setSearchSeconds(0); }
      else setRankedError(error || 'Could not join the ranked queue');
    });
  }

  function cancelSearch() {
    socketRef.current?.emit('cancel-match');
    setSearching(false);
    setSearchSeconds(0);
  }

  useEffect(() => {
    if (!searching) return;
    const id = setInterval(() => setSearchSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [searching]);

  function handleCreateRoom() {
    socketRef.current?.emit('create-room', { difficulty: diff }, ({ ok, state }) => {
      if (!ok) return;
      setRoomCode(state.code);
      go('room');
    });
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setJoinErr(true); setTimeout(() => setJoinErr(false), 700); return; }
    navigate(`/room/${code}`);
  }

  function handleCopy() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopy('Copied!'); setTimeout(() => setCopy('Copy code'), 1800);
    });
  }

  const contentStyle = motionEnabled ? {
    transform:  `perspective(1200px) rotateX(${tilt.y * 0.6}deg) rotateY(${tilt.x * 0.6}deg)`,
    transition: 'transform 0.18s ease-out',
  } : {};

  return (
    <div className={styles.root}>
      <NetworkBackground parallax={motionEnabled} />
      <div className={styles.vignette} />

      <div className={styles.reportCorner}>
        <ReportButton context={{ page: 'menu' }} openUp />
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

            {ctx === 'main' && (
              <>
                <nav className={styles.menu}>
                  <button className={styles.opt} onClick={() => go('solo')}>PLAY SOLO</button>
                  <Link to="/daily" className={styles.opt}>DAILY CHALLENGE</Link>
                  <div className={styles.rule} />
                  <button className={styles.opt} onClick={() => go('multi')}>MULTIPLAYER</button>
                  <button className={styles.opt} onClick={() => go('ranked')}>RANKED</button>
                  <button className={styles.opt} onClick={() => go('join')}>JOIN ROOM</button>
                  <div className={styles.rule} />
                  <Link to="/leaderboard" className={styles.opt}>LEADERBOARD</Link>
                  <Link to="/profile" className={styles.opt}>PROFILE</Link>
                  <Link to="/account" className={styles.opt}>ACCOUNT</Link>
                  <button className={styles.opt} onClick={() => go('how')}>HOW TO PLAY</button>
                  <div className={styles.rule} />
                  {isPro
                    ? <Link to="/pro" className={`${styles.opt} ${styles.optPro}`}>PRO FEATURES</Link>
                    : <Link to="/upgrade" className={`${styles.opt} ${styles.optLocked}`}>PRO FEATURES &#128274;</Link>
                  }
                </nav>

                <SignedOut>
                  <div className={styles.nudge}>
                    <span className={styles.nudgeText}>Free account: ranked play, leaderboards, game history, daily challenge</span>
                    <SignInButton mode="modal" afterSignInUrl="/menu">
                      <button className={styles.nudgeBtn}>Sign in free</button>
                    </SignInButton>
                  </div>
                </SignedOut>
              </>
            )}

            {ctx === 'solo' && (
              <>
                <button className={styles.back} onClick={() => go('main')}>&#8592; Back</button>
                <div className={styles.subTitle}>PLAY SOLO</div>
                <div className={styles.subHint}>Choose a difficulty and start immediately.</div>
                <div className={styles.diffGrid}>
                  {DIFFICULTIES.map(d => (
                    <div key={d.key} className={`${styles.diffTile} ${d.key === 'random' ? styles.diffTileWide : ''} ${diff === d.key ? styles.sel : ''}`} onClick={() => setDiff(d.key)}>
                      <div className={styles.diffName}>{d.label}</div>
                      <div className={styles.diffRange}>{d.range}</div>
                    </div>
                  ))}
                </div>
                <button className={styles.actionBtn} onClick={() => navigate(`/game?d=${diff}`)}>START &#8594;</button>
              </>
            )}

            {ctx === 'multi' && !searching && (
              <>
                <button className={styles.back} onClick={() => go('main')}>&#8592; Back</button>
                <div className={styles.subTitle}>MULTIPLAYER</div>
                <div className={styles.subHint}>Quick Match pairs you instantly. Create a Room to invite friends.</div>
                <button className={styles.actionBtn} onClick={handleQuickMatch}>QUICK MATCH &#8594;</button>
                <button className={`${styles.actionBtn} ${styles.actionBtnSec}`} onClick={() => go('multi-create')}>CREATE A ROOM &#8594;</button>
              </>
            )}

            {ctx === 'multi' && searching && (
              <>
                <div className={styles.subTitle}>FINDING OPPONENT</div>
                <div className={styles.searchingDot}>Searching<span className={styles.dots}>...</span> <span className={styles.searchClock}>{searchSeconds}s</span></div>
                {searchSeconds >= 15 && (
                  <div className={styles.queueFallback}>
                    <p className={styles.queueFallbackText}>You're early &mdash; tell your friends! While you wait, create a room and send the code, or play Solo.</p>
                    <div className={styles.queueFallbackActions}>
                      <button className={`${styles.actionBtn} ${styles.actionBtnSec}`} onClick={() => { cancelSearch(); go('multi-create'); }}>CREATE A ROOM</button>
                      <button className={`${styles.actionBtn} ${styles.actionBtnSec}`} onClick={() => { cancelSearch(); go('solo'); }}>PLAY SOLO</button>
                    </div>
                  </div>
                )}
                <button className={styles.back} style={{ marginTop: 20 }} onClick={cancelSearch}>&#8592; Cancel</button>
              </>
            )}

            {ctx === 'ranked' && !searching && (
              <>
                <button className={styles.back} onClick={() => go('main')}>&#8592; Back</button>
                <div className={styles.subTitle}>RANKED</div>
                <div className={styles.subHint}>Matchmaking only. Affects your 1v1 rating.</div>
                <SignedIn>
                  {myElo && myElo.isPlacement && (
                    <div className={styles.rankPreview}>
                      <span className={styles.rankPreviewLabel}>PLACEMENT MATCHES</span>
                      <span className={styles.rankPreviewBig}>{myElo.gamesPlayed}/5</span>
                    </div>
                  )}
                  {myElo && !myElo.isPlacement && (
                    <div className={styles.rankPreview}>
                      <span className={`${styles.rankPreviewBadge} ${styles[RANK_CLASS[myElo.rank]] || ''}`}>{myElo.rank}</span>
                      <span className={styles.rankPreviewBig}>{myElo.elo}</span>
                      <span className={styles.rankPreviewSub}>{myElo.wins}W&ndash;{myElo.losses}L</span>
                    </div>
                  )}
                  {rankedError && <p className={styles.rankedError}>{rankedError}</p>}
                  <button className={styles.actionBtn} onClick={handleRankedMatch}>FIND RANKED MATCH &#8594;</button>
                </SignedIn>
                <SignedOut>
                  <p className={styles.subHint}>You need an account to play Ranked.</p>
                  <SignInButton mode="modal" afterSignInUrl="/menu">
                    <button className={styles.actionBtn}>SIGN IN FREE &#8594;</button>
                  </SignInButton>
                </SignedOut>
              </>
            )}

            {ctx === 'ranked' && searching && (
              <>
                <div className={styles.subTitle}>FINDING RANKED OPPONENT</div>
                <div className={styles.searchingDot}>Searching<span className={styles.dots}>...</span> <span className={styles.searchClock}>{searchSeconds}s</span></div>
                {searchSeconds >= 15 && (
                  <div className={styles.queueFallback}>
                    <p className={styles.queueFallbackText}>You're early &mdash; tell your friends! Create an unranked room and send the code, or play Solo while you wait.</p>
                    <div className={styles.queueFallbackActions}>
                      <button className={`${styles.actionBtn} ${styles.actionBtnSec}`} onClick={() => { cancelSearch(); go('multi-create'); }}>CREATE A ROOM</button>
                      <button className={`${styles.actionBtn} ${styles.actionBtnSec}`} onClick={() => { cancelSearch(); go('solo'); }}>PLAY SOLO</button>
                    </div>
                  </div>
                )}
                <button className={styles.back} style={{ marginTop: 20 }} onClick={cancelSearch}>&#8592; Cancel</button>
              </>
            )}

            {ctx === 'multi-create' && (
              <>
                <button className={styles.back} onClick={() => go('multi')}>&#8592; Back</button>
                <div className={styles.subTitle}>CREATE A ROOM</div>
                <div className={styles.subHint}>Choose difficulty. Share the room code with friends.</div>
                <div className={styles.diffGrid}>
                  {DIFFICULTIES.map(d => (
                    <div key={d.key} className={`${styles.diffTile} ${d.key === 'random' ? styles.diffTileWide : ''} ${diff === d.key ? styles.sel : ''}`} onClick={() => setDiff(d.key)}>
                      <div className={styles.diffName}>{d.label}</div>
                      <div className={styles.diffRange}>{d.range}</div>
                    </div>
                  ))}
                </div>
                <button className={styles.actionBtn} onClick={handleCreateRoom}>CREATE ROOM &#8594;</button>
              </>
            )}

            {ctx === 'room' && (
              <>
                <button className={styles.back} onClick={() => go('multi')}>&#8592; Back</button>
                <div className={styles.subTitle}>ROOM CREATED</div>
                <div className={styles.subHint}>Share this code with your friends.</div>
                <div className={styles.codeWrap}>
                  <div className={styles.codeLbl}>Room code</div>
                  <div className={styles.codeVal}>{roomCode}</div>
                  <div className={styles.codeSub}>wikiracr.com &#8594; Join a Room</div>
                  <button className={styles.copyBtn} onClick={handleCopy}>{copyLabel}</button>
                </div>
                <button className={styles.actionBtn} onClick={() => navigate(`/room/${roomCode}?d=${diff}`)}>GO TO ROOM &#8594;</button>
              </>
            )}

            {ctx === 'join' && (
              <>
                <button className={styles.back} onClick={() => go('main')}>&#8592; Back</button>
                <div className={styles.subTitle}>JOIN A ROOM</div>
                <div className={styles.subHint}>Enter the room code you were given.</div>
                <input
                  className={`${styles.codeInput} ${joinErr ? styles.err : ''}`}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  maxLength={6} placeholder="XXXXXX" autoFocus
                />
                <button className={styles.actionBtn} onClick={handleJoin}>JOIN &#8594;</button>
              </>
            )}

            {ctx === 'how' && (
              <>
                <button className={styles.back} onClick={() => go('main')}>&#8592; Back</button>
                <div className={styles.subTitle}>HOW TO PLAY</div>
                <div className={styles.howtoList}>
                  {[
                    {
                      n: '1',
                      t: 'Get your pair',
                      b: 'Each round gives you a start article and a goal article.',
                    },
                    {
                      n: '2',
                      t: 'Navigate',
                      b: 'Click links inside Wikipedia articles to move from page to page.',
                    },
                    {
                      n: '3',
                      t: 'Reach the goal',
                      b: 'Find your way to the goal article. Each mode has its own win condition.',
                    },
                  ].map(r => (
                    <div key={r.n} className={styles.howtoItem}>
                      <div className={styles.howtoN}>{r.n}</div>
                      <div><div className={styles.howtoT}>{r.t}</div><div className={styles.howtoB}>{r.b}</div></div>
                    </div>
                  ))}
                </div>
                <Link to="/how-to-play" className={styles.actionBtn}>FULL GUIDE &#8594;</Link>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
