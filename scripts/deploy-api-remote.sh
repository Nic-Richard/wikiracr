#!/usr/bin/env bash
set -euo pipefail
umask 077

[[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]] || exit 64
revision="${BASH_REMATCH[1]}"
root=/var/www/wikiracr
backup=/root/deploy-backups/wikiracr-github-previous
exec 9>/run/lock/wikiracr-github-deploy.lock
flock -n 9 || { echo 'Another API deployment is running.'; exit 75; }
stage=$(mktemp -d /var/tmp/wikiracr-deploy.XXXXXX)
[[ "$stage" == /var/tmp/wikiracr-deploy.* && -d "$stage" ]] || exit 70
trap 'rm -rf -- "$stage"' EXIT
head -c 104857601 > "$stage/source.tar.gz"
[[ $(stat -c %s "$stage/source.tar.gz") -le 104857600 ]] || exit 65
python3 - "$stage/source.tar.gz" "$stage" <<'PY'
import pathlib, sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    for item in archive.getmembers():
        path = pathlib.PurePosixPath(item.name)
        allowed = item.name in ('server', 'server/package.json', 'server/package-lock.json', 'server/src', 'server/scripts', 'client', 'client/dist') or item.name.startswith(('server/src/', 'server/scripts/', 'client/dist/'))
        if not allowed or path.is_absolute() or '..' in path.parts or not (item.isfile() or item.isdir()):
            raise SystemExit('Unexpected deployment archive entry')
    archive.extractall(sys.argv[2], filter='data')
PY
find "$stage/server/src" "$stage/server/scripts" -name '*.js' -exec node --check {} \;
test -f "$stage/client/dist/index.html"
test -f "$stage/client/dist/404.html"
(umask 022 && cd "$stage/server" && npm ci --omit=dev)
node "$stage/server/scripts/smoke-room.js"

install -d -m 700 "$backup"
tar -czf "$backup/source.tar.gz" -C "$root" server/src server/scripts server/package.json server/package-lock.json client/dist
node - "$root" "$backup/app.db" <<'JS'
const [root, destination] = process.argv.slice(2);
const Database = require(root + '/server/node_modules/better-sqlite3');
const db = new Database(root + '/data/app.db', { readonly: true, fileMustExist: true });
db.backup(destination).then(() => db.close()).catch(error => { db.close(); console.error(error.message); process.exitCode = 1; });
JS
changed=0
rollback() {
  status=$?
  trap - ERR
  if [[ $changed == 1 ]]; then
    echo 'Deployment failed; restoring the previous API code. Databases remain untouched.'
    rsync -a --delete --chmod=go=rX "$stage/restore/server/src/" "$root/server/src/"
    rsync -a --delete --chmod=go=rX "$stage/restore/server/scripts/" "$root/server/scripts/"
    cp "$stage/restore/server/package.json" "$stage/restore/server/package-lock.json" "$root/server/"
    (umask 022 && cd "$root/server" && npm ci --omit=dev)
    (cd "$root" && pm2 reload ecosystem.config.js --only wikiracr)
    if [[ -d "$stage/restore/client/dist" ]]; then
      rsync -a --delete --chmod=D755,F644 "$stage/restore/client/dist/" "$root/client/dist/"
    fi
  fi
  exit "$status"
}
install -d -m 700 "$stage/restore"
tar -xzf "$backup/source.tar.gz" -C "$stage/restore"
trap rollback ERR
changed=1
rsync -a --delete --chmod=go=rX "$stage/server/src/" "$root/server/src/"
rsync -a --delete --chmod=go=rX "$stage/server/scripts/" "$root/server/scripts/"
cp "$stage/server/package.json" "$stage/server/package-lock.json" "$root/server/"
rsync -a --delete --chmod=go=rX "$stage/server/node_modules/" "$root/server/node_modules/"
(cd "$root" && pm2 reload ecosystem.config.js --only wikiracr)
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3001/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:3001/health
curl --fail --silent --dump-header "$stage/headers" -o /dev/null -H 'Origin: https://localhost' http://127.0.0.1:3001/health
grep -iq '^access-control-allow-origin: https://localhost' "$stage/headers"
# Old hashed assets stay so open tabs keep loading.
rsync -a --chmod=D755,F644 "$stage/client/dist/" "$root/client/dist/"
entry=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$stage/client/dist/index.html" | head -1)
curl --fail --silent --max-time 5 --resolve wikiracr.com:443:127.0.0.1 https://wikiracr.com/ | grep -qF "$entry"
printf '%s\n' "$revision" > "$root/.api-release"
trap - ERR
echo "API deployed: $revision"
