import { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MotionProvider } from './lib/MotionContext';
import { GamePreferencesProvider } from './lib/GamePreferencesContext';
import MotionToggle from './components/MotionToggle';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import Upgrade from './pages/Upgrade';
import UpgradeSuccess from './pages/UpgradeSuccess';
import HigherOrLower from './pages/HigherOrLower';
import CustomLobby from './pages/CustomLobby';
import Speedrun from './pages/Speedrun';
import Daily from './pages/Daily';
import Profile from './pages/Profile';
import Account from './pages/Account';
import ProFeatures from './pages/ProFeatures';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import HowToPlay from './pages/HowToPlay';
import WikiRace from './pages/WikiRace';
import NotFound from './pages/NotFound';


const SITE_URL = 'https://wikiracr.com';

const ROUTE_META = {
  '/': {
    title: 'WikiRacr | Competitive Wikipedia Racing Game',
    description: 'Play WikiRacr, a competitive Wikipedia racing game where you navigate from one article to another through Wikipedia links.',
  },
  '/menu': {
    title: 'Play WikiRacr | Solo, Multiplayer, Ranked, and Daily',
    description: 'Choose a WikiRacr mode and start racing through Wikipedia links solo, with friends, or on the Daily Challenge.',
  },
  '/wiki-race': {
    title: 'Wiki Racing Online | Play a Wikipedia Racing Game',
    description: 'Play WikiRacr, an online wiki racing game where you navigate through Wikipedia links from a start article to a goal article.',
  },
  '/how-to-play': {
    title: 'How to Play WikiRacr | Wikipedia Racing Rules',
    description: 'Learn how to play WikiRacr, a Wikipedia racing game where you navigate from one article to another through Wikipedia links.',
  },
  '/daily': {
    title: 'WikiRacr Daily Challenge | Wikipedia Racing Game',
    description: 'Take on the WikiRacr Daily Challenge and race the same Wikipedia article pair as everyone else.',
  },
  '/leaderboard': {
    title: 'WikiRacr Leaderboard | Top Wikipedia Racers',
    description: 'See top WikiRacr players and daily results for the competitive Wikipedia racing game.',
  },
  '/speedrun': {
    title: 'Wikipedia Speedrun | WikiRacr Pro Mode',
    description: 'Speedrun mode times you across five Wikipedia article pairs back to back. Only your total time counts, not path length.',
  },
  '/higher-or-lower': {
    title: 'Higher or Lower | Wikipedia Article Views Game',
    description: 'Guess which Wikipedia article gets more monthly views in WikiRacr\u2019s Higher or Lower mode.',
  },
  '/upgrade': {
    title: 'WikiRacr Pro | Upgrade Your Wikipedia Racing Game',
    description: 'Upgrade WikiRacr for more game modes, custom lobbies, history, stats, and Pro features.',
  },
  '/terms': {
    title: 'Terms | WikiRacr',
    description: 'Read the terms for using WikiRacr.',
  },
  '/privacy': {
    title: 'Privacy | WikiRacr',
    description: 'Read the WikiRacr privacy policy.',
  },
};

const KNOWN_PATHS = [
  '/', '/menu', '/game', '/leaderboard', '/wiki-race', '/how-to-play',
  '/upgrade', '/upgrade/success', '/higher-or-lower', '/custom-lobby',
  '/speedrun', '/daily', '/profile', '/account', '/pro', '/terms', '/privacy',
];

// Exclude personalized and session-specific routes from indexing.
const NOINDEX_PATHS = ['/profile', '/account', '/game', '/custom-lobby', '/pro', '/upgrade/success'];

function isKnownPath(pathname) {
  return KNOWN_PATHS.includes(pathname) || pathname.startsWith('/room/');
}

function isNoindexPath(pathname) {
  return NOINDEX_PATHS.includes(pathname) || pathname.startsWith('/room/');
}

function setMeta(selector, value) {
  const node = document.head.querySelector(selector);
  if (node) node.setAttribute('content', value);
}

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const notFound = !isKnownPath(pathname);
    const noindex = notFound || isNoindexPath(pathname);
    const meta = notFound
      ? { title: 'Page not found | WikiRacr', description: 'This page does not exist on WikiRacr.' }
      : (ROUTE_META[pathname] || ROUTE_META['/']);
    const canonical = notFound ? SITE_URL : `${SITE_URL}${pathname === '/' ? '/' : pathname}`;

    document.title = meta.title;
    setMeta('meta[name="description"]', meta.description);
    setMeta('meta[name="robots"]', noindex ? 'noindex, follow' : 'index, follow');
    setMeta('meta[property="og:title"]', meta.title);
    setMeta('meta[property="og:description"]', meta.description);
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[name="twitter:title"]', meta.title);
    setMeta('meta[name="twitter:description"]', meta.description);

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }, [pathname]);

  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      document.querySelectorAll('[data-route-scroll]').forEach((node) => {
        node.scrollTop = 0;
      });
    };

    resetScroll();
    requestAnimationFrame(resetScroll);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <MotionProvider>
        <GamePreferencesProvider>
        <RouteMetadata />
        <ScrollToTop />
        <Routes>
          <Route path="/"                element={<Home />} />
          <Route path="/menu"            element={<Menu />} />
          <Route path="/game"            element={<Game />} />
          <Route path="/room/:code"      element={<Game />} />
          <Route path="/leaderboard"     element={<Leaderboard />} />
          <Route path="/wiki-race"       element={<WikiRace />} />
          <Route path="/how-to-play"     element={<HowToPlay />} />
          <Route path="/upgrade"         element={<Upgrade />} />
          <Route path="/upgrade/success" element={<UpgradeSuccess />} />
          <Route path="/higher-or-lower" element={<HigherOrLower />} />
          <Route path="/custom-lobby"    element={<CustomLobby />} />
          <Route path="/speedrun"        element={<Speedrun />} />
          <Route path="/daily"           element={<Daily />} />
          <Route path="/profile"         element={<Profile />} />
          <Route path="/account"         element={<Account />} />
          <Route path="/pro"             element={<ProFeatures />} />
          <Route path="/terms"           element={<Terms />} />
          <Route path="/privacy"         element={<Privacy />} />
          <Route path="*"                element={<NotFound />} />
        </Routes>
        <MotionToggle />
        </GamePreferencesProvider>
      </MotionProvider>
    </BrowserRouter>
  );
}
