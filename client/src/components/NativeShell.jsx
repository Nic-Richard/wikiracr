import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NativeApp, NativeBrowser, NativeMotion } from '../lib/platform';
import { useMotion } from '../lib/MotionContext';
import { resumeSocket, setSocketTokenGetter } from '../lib/socket';
import './NativeShell.css';

export default function NativeShell() {
  const location = useLocation(), navigate = useNavigate();
  const { getToken, refresh } = useAuth();
  const { enabled: motionEnabled } = useMotion();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [leave, setLeave] = useState(false);
  const inGame = /^\/(game|room|daily)(?:\/|$)/.test(location.pathname);
  useEffect(() => {
    if (!motionEnabled) return;
    let stopped = false, listener;
    (async () => {
      const handle = await NativeMotion.addListener('tilt', detail => window.dispatchEvent(new CustomEvent('wikiracr-tilt', { detail })));
      if (stopped) { handle.remove(); return; }
      listener = handle;
      await NativeMotion.start();
      if (stopped) NativeMotion.stop();
    })().catch(() => {});
    return () => { stopped = true; listener?.remove(); NativeMotion.stop().catch(() => {}); };
  }, [motionEnabled]);
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
      if (document.querySelector('[data-native-report]')) window.dispatchEvent(new Event('native-report-back'));
      else if (document.querySelector('[data-native-race]')) setLeave(true);
      else if (document.querySelector('[data-native-menu]:not([data-menu-panel="main"])')) window.dispatchEvent(new Event('native-menu-back'));
      else if (inGame) navigate('/');
      else if (document.querySelector('[data-native-menu]')) NativeApp.minimizeApp();
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
    {leave && <div className="native-dialog-shade"><section className="native-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">Leave this game?</h2><p>Your current race will end. You can stay and keep playing.</p><div><button onClick={() => setLeave(false)} autoFocus>Keep playing</button><button className="danger" onClick={() => { setLeave(false); navigate('/'); }}>Leave game</button></div></section></div>}
  </>;
}
