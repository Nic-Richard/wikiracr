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

LOCAL_DB="${1:-$ROOT_DIR/data/pairs.db}"
REMOTE_DB="$REMOTE/data/pairs.db"

if [[ ! -f "$LOCAL_DB" ]]; then
  echo "ERROR: $LOCAL_DB not found."
  exit 1
fi

python - "$LOCAL_DB" <<'PY'
import sqlite3
import sys

path = sys.argv[1]
with sqlite3.connect(path) as connection:
    result = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if result != "ok":
        raise SystemExit(f"Integrity check failed: {result}")
    count = connection.execute("SELECT COUNT(*) FROM pairs").fetchone()[0]
    print(f"Validated {count:,} pairs.")
PY

ssh "$SERVER" "mkdir -p '$REMOTE/data' && pm2 stop wikiracr && rm -f '$REMOTE_DB-wal' '$REMOTE_DB-shm'"
scp "$LOCAL_DB" "$SERVER:$REMOTE_DB"

LOCAL_SIZE="$(wc -c < "$LOCAL_DB" | tr -d ' ')"
REMOTE_SIZE="$(ssh "$SERVER" "wc -c < '$REMOTE_DB'" | tr -d ' ')"

if [[ "$LOCAL_SIZE" != "$REMOTE_SIZE" ]]; then
  echo "ERROR: size mismatch after upload. The app remains stopped."
  exit 1
fi

ssh "$SERVER" "pm2 start wikiracr"
echo "pairs.db updated."
