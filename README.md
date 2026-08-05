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

- Node.js 18 or newer
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
