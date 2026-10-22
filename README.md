# WikiRacr

WikiRacr is a competitive Wikipedia game where players race from one article to another by following links only, with fewer clicks and faster times producing better results.

The project grew from my work with graph search on Wikipedia link data. I built forward and reverse graphs and used bidirectional breadth-first search to find shortest valid paths between articles, then used that system to help curate challenge pairs that are recognizable and enjoyable to play. That technical foundation supports the polished game flow, daily challenges, multiplayer rooms, rankings, and custom modes.

**Live site:** https://wikiracr.com

## Features

- Solo play and a shared daily challenge
- Real-time multiplayer rooms with ranked and casual play
- Custom lobbies, speedrun, knockout, clicks, and score modes
- Higher or Lower using current Wikipedia pageview data
- Player profiles, leaderboards, match history, and Elo ratings
- Pro subscriptions through Stripe
- Responsive gameplay across desktop and mobile

## Tech stack

- React and Vite
- Node.js and Express
- Socket.IO
- SQLite with better-sqlite3
- Clerk authentication
- Stripe subscriptions
- Wikimedia APIs, SQL dumps, and pageview datasets
- Nginx and PM2 in production

## Repository structure

```text
client/                 React frontend
server/                 API, game server, and Socket.IO handlers
data/                   Runtime article datasets
tools/pair-generator/   Local Wikipedia graph and dataset pipeline
scripts/                Deployment and dataset upload scripts
```

The generator runs locally because the Wikimedia dumps and graph caches are large. The generated `pairs.db` and `higherlower_articles.json` files are included so a fresh clone can run without rebuilding the full dataset.

## Local setup

### Prerequisites

- Node.js 22.13 or newer
- npm
- Python 3.8 or newer only when rebuilding datasets
- Clerk development keys
- Stripe test keys for subscription flows

### Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### Client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment variables

### Server

| Variable | Purpose |
|---|---|
| `PORT` | Express and Socket.IO port |
| `CLIENT_URL` | Allowed frontend origin |
| `DB_PATH` | Pair dataset path |
| `APP_DB_PATH` | Runtime user and game data path |
| `HIGHERLOWER_PATH` | Higher or Lower article dataset path |
| `CLERK_SECRET_KEY` | Clerk server key |
| `STRIPE_SECRET_KEY` | Stripe server key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe price used for Pro subscriptions |

### Client

| Variable | Purpose |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk browser key |
| `VITE_SERVER_URL` | API and Socket.IO server URL |

Never commit real environment files. The included `.env.example` files contain placeholders only.

## Checks

```bash
npm ci --prefix server
npm ci --prefix client
npm run smoke:room --prefix server
npm test --prefix server
npm run stress --prefix server -- --rooms 20
npm run build --prefix client
node --test client/tests/*.test.mjs
node client/scripts/check-prerender.mjs
```

`npm run stress` plays many head-to-head races at once over real Socket.IO connections
(`--rooms`, `--players`, `--clicks`), with Wikipedia link checks stubbed and a temporary
player database. It needs the server's native SQLite module, so on Windows run it in a
Node 20 container. Oct 22: 1,000 rooms (2,000 players) all finished; p95 127 ms, peak 237 MB.

GitHub Actions runs these checks and server syntax checks on pushes to main and pull requests.
The tests use local fixtures; they do not contact Wikipedia, Clerk, or Stripe. Database tests
exercise the SQL against Node's in-memory SQLite engine.

The web build prerenders the homepage, wiki-racing introduction, rules, legal pages
and missing-page view from the existing React components. They hydrate into the
same application; game, account and room routes keep the client app. Build-time
rendering makes no network requests and includes no player or session data.
Route metadata is shared between the build and browser navigation. Nginx serves
the generated route entry points and returns HTTP 404 for unknown paths.

The browser check requires Chrome (`CHROME_PATH` can override its location) and
blocks external services, API requests and sockets. CI uses a placeholder Clerk
publishable key for these offline checks. Normal production builds use the client
environment's real publishable key. Android's separate Vite build stays unchanged.

Daily and speedrun challenges reveal optimal routes after a verified completion. Signed-in
daily attempts use a persisted server clock, with visibility updates every ten seconds and
a thirty-second grace period if a tab disappears. Existing saved paths remain resumable;
older browser-reported elapsed times are not used for leaderboard scores.

## Dataset generation

The pair generator builds a directed Wikipedia graph, ranks articles with Wikimedia pageviews, and finds playable routes with bidirectional breadth-first search. See [`tools/pair-generator/README.md`](tools/pair-generator/README.md) for the full process.

## Validation

```bash
cd client
npm run build

cd ../server
npm run smoke:room
```

## Deployment

The scripts under `scripts/` read the production host from local environment variables instead of storing server details in the repository:

```bash
export WIKIRACR_SERVER=user@example.com
export WIKIRACR_REMOTE=/var/www/wikiracr
bash scripts/deploy.sh
```

Production secrets remain in local `.env` files and are excluded by `.gitignore`.

The current production layout keeps the two generated datasets at the project root. Local development uses the paths in `server/.env.example`, which point to the versioned files under `data/`.
