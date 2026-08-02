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

LOCAL_JSON="${1:-$ROOT_DIR/data/higherlower_articles.json}"
REMOTE_JSON="$REMOTE/data/higherlower_articles.json"

if [[ ! -f "$LOCAL_JSON" ]]; then
  echo "ERROR: $LOCAL_JSON not found."
  exit 1
fi

python - "$LOCAL_JSON" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as file:
    data = json.load(file)

required = {"title", "views", "inlinks", "source"}
if not isinstance(data, list) or not data:
    raise SystemExit("Expected a non-empty JSON array.")
if any(not required.issubset(entry) for entry in data):
    raise SystemExit("One or more entries are missing required fields.")

print(f"Validated {len(data):,} articles.")
PY

ssh "$SERVER" "mkdir -p '$REMOTE/data'"
scp "$LOCAL_JSON" "$SERVER:$REMOTE_JSON"

LOCAL_SIZE="$(wc -c < "$LOCAL_JSON" | tr -d ' ')"
REMOTE_SIZE="$(ssh "$SERVER" "wc -c < '$REMOTE_JSON'" | tr -d ' ')"

if [[ "$LOCAL_SIZE" != "$REMOTE_SIZE" ]]; then
  echo "ERROR: size mismatch after upload."
  exit 1
fi

ssh "$SERVER" "pm2 restart wikiracr"
echo "higherlower_articles.json updated."
