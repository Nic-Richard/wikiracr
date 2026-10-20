import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { MotionProvider } from './lib/MotionContext';
import { GamePreferencesProvider } from './lib/GamePreferencesContext';
import MotionToggle from './components/MotionToggle';
import Home from './pages/Home';
import WikiRace from './pages/WikiRace';
import HowToPlay from './pages/HowToPlay';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';

const pages = {
  '/': Home,
  '/wiki-race': WikiRace,
  '/how-to-play': HowToPlay,
  '/privacy': Privacy,
  '/terms': Terms,
  '/404': NotFound,
};

export const prerenderPaths = Object.keys(pages);

export function render(pathname, publishableKey) {
  const Page = pages[pathname];
  return renderToString(
    <StrictMode>
      <AuthProvider publishableKey={publishableKey}>
        <StaticRouter location={pathname}>
          <MotionProvider>
            <GamePreferencesProvider>
              <div><Page /></div>
              <MotionToggle />
            </GamePreferencesProvider>
          </MotionProvider>
        </StaticRouter>
      </AuthProvider>
    </StrictMode>
  );
}
