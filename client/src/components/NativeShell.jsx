import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NativeApp, NativeBrowser } from '../lib/platform';
import { resumeSocket, setSocketTokenGetter } from '../lib/socket';
import './NativeShell.css';

const TABS = [['/', 'Play', 'M8 5l10 7-10 7z'], ['/leaderboard', 'Ranks', 'M5 20v-6h4v6M10 20V4h4v16M15 20V9h4v11'], ['/profile', 'Player', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21v-2a7 7 0 0 1 14 0v2'], ['/account', 'Settings', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2']];

export default function NativeShell() {
  const location = useLocation(), navigate = useNavigate();
  const { getToken, refresh } = useAuth();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [leave, setLeave] = useState(false);
  const inGame = /^\/(game|room|daily)(?:\/|$)/.test(location.pathname);
  useEffect(() => {
    const update = () => { setOffline(!navigator.onLine); if (navigator.onLine) resumeSocket(); };
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { setSocketTokenGetter(getToken); return () => setSocketTokenGetter(null); }, [getToken]);
  useEffect(() => {
    let stopped = false; const handles = [];
    const listen = async (event, callback) => {
      const handle = await NativeApp.addListener(event, callback);
      if (stopped) handle.remove(); else handles.push(handle);
    };
    listen('backButton', () => {
      if (document.querySelector('[data-native-race]')) setLeave(true);
      else if (inGame) navigate('/');
      else if (location.pathname !== '/') navigate(-1);
      else NativeApp.minimizeApp();
    });
    listen('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      try { await refresh(); } catch {}
      resumeSocket();
    });
    return () => { stopped = true; handles.forEach(handle => handle.remove()); };
  }, [getToken, refresh, inGame, location.pathname, navigate]);
  useEffect(() => {
    const openExternal = event => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target !== '_blank') return;
      const url = new URL(link.href);
      if (!['https:', 'http:'].includes(url.protocol)) return;
      event.preventDefault(); NativeBrowser.open({ url: url.href });
    };
    document.addEventListener('click', openExternal);
    return () => document.removeEventListener('click', openExternal);
  }, []);
  return <>
    {offline && <div className="native-offline" role="status">You’re offline. Reconnect to start or resume a race.</div>}
    {!inGame && <nav className="native-tabs" aria-label="Main navigation">{TABS.map(([to, label, path]) => <NavLink key={to} to={to} end={to === '/'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg><span>{label}</span></NavLink>)}</nav>}
    {leave && <div className="native-dialog-shade"><section className="native-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">Leave this game?</h2><p>Your current race will end. You can stay and keep playing.</p><div><button onClick={() => setLeave(false)} autoFocus>Keep playing</button><button className="danger" onClick={() => { setLeave(false); navigate('/'); }}>Leave game</button></div></section></div>}
  </>;
}
