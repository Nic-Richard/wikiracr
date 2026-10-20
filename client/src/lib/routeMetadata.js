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

export const KNOWN_PATHS = [
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

export function getRouteMetadata(value) {
  const pathname = value.replace(/\/+$/, '') || '/';
  const notFound = !isKnownPath(pathname);
  const meta = notFound
    ? { title: 'Page not found | WikiRacr', description: 'This page does not exist on WikiRacr.' }
    : (ROUTE_META[pathname] || ROUTE_META['/']);
  return {
    ...meta,
    canonical: notFound ? SITE_URL + '/' : SITE_URL + pathname,
    robots: notFound || isNoindexPath(pathname) ? 'noindex, follow' : 'index, follow',
  };
}
