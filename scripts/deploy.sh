#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV="$ROOT_DIR/.env.deploy"

if [[ -f "$DEPLOY_ENV" ]]; then
  set -a
  source "$DEPLOY_ENV"
  set +a
fi

SERVER="${WIKIRACR_SERVER:?Set WIKIRACR_SERVER in .env.deploy}"
REMOTE="${WIKIRACR_REMOTE:-/var/www/wikiracr}"

cd "$ROOT_DIR"

echo "Deploying WikiRacr to $SERVER:$REMOTE..."

ssh "$SERVER" "mkdir -p '$REMOTE/server' '$REMOTE/client' '$REMOTE/data' '$REMOTE/logs'"

scp -r server/src server/scripts "$SERVER:$REMOTE/server/"
scp server/package.json "$SERVER:$REMOTE/server/package.json"

if [[ -f server/package-lock.json ]]; then
  scp server/package-lock.json "$SERVER:$REMOTE/server/package-lock.json"
fi

scp -r client/src client/public "$SERVER:$REMOTE/client/"
scp client/package.json client/package-lock.json client/vite.config.js client/index.html "$SERVER:$REMOTE/client/"
scp ecosystem.config.js "$SERVER:$REMOTE/ecosystem.config.js"

scp data/pairs.db "$SERVER:$REMOTE/data/pairs.db"
scp data/higherlower_articles.json "$SERVER:$REMOTE/data/higherlower_articles.json"

if [[ -f client/.env ]]; then
  scp client/.env "$SERVER:$REMOTE/client/.env"
fi

if [[ -f server/.env ]]; then
  scp server/.env "$SERVER:$REMOTE/server/.env"
fi

ssh "$SERVER" "cd '$REMOTE/server' && if [[ -f package-lock.json ]]; then npm ci --omit=dev; else npm install --omit=dev; fi"
ssh "$SERVER" "cd '$REMOTE/client' && npm ci && npm run build"
ssh "$SERVER" "nginx -t && systemctl reload nginx"
ssh "$SERVER" "cd '$REMOTE' && pm2 startOrRestart ecosystem.config.js"

echo "WikiRacr deployed."
