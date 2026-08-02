import { createContext, useContext, useState } from 'react';

const GamePreferencesContext = createContext({
  muted: false,
  chatEnabled: true,
  toggleMute: () => {},
  toggleChat: () => {},
});

export function GamePreferencesProvider({ children }) {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('wikiracr-muted') === 'true'; }
    catch { return false; }
  });

  const [chatEnabled, setChatEnabled] = useState(() => {
    try { return localStorage.getItem('wikiracr-chat-enabled') !== 'false'; }
    catch { return true; }
  });

  function toggleMute() {
    setMuted(value => {
      const next = !value;
      try { localStorage.setItem('wikiracr-muted', String(next)); } catch {}
      return next;
    });
  }

  function toggleChat() {
    setChatEnabled(value => {
      const next = !value;
      try { localStorage.setItem('wikiracr-chat-enabled', String(next)); } catch {}
      return next;
    });
  }

  return (
    <GamePreferencesContext.Provider value={{ muted, chatEnabled, toggleMute, toggleChat }}>
      {children}
    </GamePreferencesContext.Provider>
  );
}

export function useGamePreferences() {
  return useContext(GamePreferencesContext);
}
