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
import { NATIVE_APP } from './lib/platform';
import NativeShell from './components/NativeShell';
import { getRouteMetadata } from './lib/routeMetadata';

function setMeta(selector, value) {
  const node = document.head.querySelector(selector);
  if (node) node.setAttribute('content', value);
}

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = getRouteMetadata(pathname);
    const canonical = meta.canonical;

    document.title = meta.title;
    setMeta('meta[name="description"]', meta.description);
    setMeta('meta[name="robots"]', meta.robots);
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
        <div className={NATIVE_APP ? 'native-content' : undefined}>
        <Routes>
          <Route path="/"                element={NATIVE_APP ? <Menu /> : <Home />} />
          <Route path="/menu"            element={<Menu />} />
          <Route path="/game"            element={<Game />} />
          <Route path="/room/:code"      element={<Game />} />
          <Route path="/leaderboard"     element={<Leaderboard />} />
          <Route path="/wiki-race"       element={<WikiRace />} />
          <Route path="/how-to-play"     element={<HowToPlay />} />
          <Route path="/upgrade"         element={<Upgrade />} />
          <Route path="/upgrade/success" element={NATIVE_APP ? <Upgrade /> : <UpgradeSuccess />} />
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
        </div>
        {NATIVE_APP ? <NativeShell /> : <MotionToggle />}
        </GamePreferencesProvider>
      </MotionProvider>
    </BrowserRouter>
  );
}
