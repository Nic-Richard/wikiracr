import { createContext, useContext, useState } from 'react';

const MotionContext = createContext({ enabled: true, toggle: () => {} });

export function MotionProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('wikiracr-motion') !== 'false'; }
    catch { return true; }
  });

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
