# API deployment

Run **Deploy API** from GitHub Actions on `main`. It deploys the exact selected
commit only after that commit's push CI succeeds and Nic approves the **Production**
environment. It never runs automatically on push.

The workflow sends only `server/src`, `server/scripts` and the server package files.
It does not deploy the website, mobile artifacts, environment files or databases.
The server's existing Node 20 runtime and PM2 configuration stay in use.

## Access

Production environment secrets:

- `WIKIRACR_DEPLOY_KEY`: dedicated Ed25519 key, used only for this workflow.
- `WIKIRACR_DEPLOY_KNOWN_HOSTS`: server host key obtained over the existing trusted SSH connection.

The server's corresponding authorized key uses `restrict` and the forced command
`/usr/local/sbin/wikiracr-github-deploy`. It accepts only `deploy <40-character SHA>`
and a source archive on standard input. It cannot open an interactive shell, SCP,
forward ports or deploy arbitrary paths. Deployment still executes the approved
API code with the existing production service's root permissions; protect the key
and keep Production approval enabled.

The installed helper is `scripts/deploy-api-remote.sh`. Updating that file in Git
does not automatically replace the installed helper. Review and install helper
changes separately over existing administrative SSH access.

## Checks and recovery

The helper serializes deployments, rejects unexpected archive paths and symlinks,
checks JavaScript syntax, installs locked production dependencies in a temporary
directory and runs the room smoke checks before touching the running API.

Immediately before changing code, it saves the previous API source and a consistent
SQLite `app.db` backup in `/root/deploy-backups/wikiracr-github-previous`. This single
rollback is replaced on each deployment. The separate pre-deletion rollback remains
untouched. Temporary staging files are removed when the command exits.

After PM2 reload, both `/health` and the Android origin response must pass. Failure
restores the previous code and dependencies and reloads it. Databases are never
automatically restored, so new player data is preserved. Database recovery or schema
migrations need their own plan and approval. Successful deployments record the SHA
in `/var/www/wikiracr/.api-release`.

The Android app needs `Access-Control-Allow-Origin: https://localhost`, including
Socket.IO requests. A successful workflow is followed by external health/origin
checks and physical-phone sign-in and game checks.
