import { createContext, useContext, useEffect, useState } from 'react';
import { NATIVE_APP } from './platform';

const MotionContext = createContext({ enabled: true, toggle: () => {} });

export function MotionProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    if (!NATIVE_APP) return true;
    try { return localStorage.getItem('wikiracr-motion') !== 'false'; }
    catch { return true; }
  });

  useEffect(() => {
    if (NATIVE_APP) return;
    try { setEnabled(localStorage.getItem('wikiracr-motion') !== 'false'); }
    catch {}
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem('wikiracr-motion', String(next)); }
    catch {}
  }

  return (
    <MotionContext.Provider value={{ enabled, toggle }}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotion() {
  return useContext(MotionContext);
}
