# Account deletion

Account > Delete account requires the signed-in player's token and the exact word
`DELETE`. The server immediately blocks new account requests and disconnects the
player. A SQLite job retries failed cleanup every minute after in-flight requests
have drained.

Cleanup expires that player's open checkouts, cancels their active WikiRacr
subscriptions without proration, removes matching bot alerts, clears game history,
daily progress/clocks, scores, rankings and reports, then deletes the Clerk identity.
Score writers refuse closed accounts so an older request cannot recreate their data.
Room snapshots and matchmaking connections are removed; other players remain.
Late payment references merge into the saved job, restart its alert scan and reopen
a completed job when necessary, so an older worker snapshot cannot discard them.

Completed receipts retain limited identifiers for 30 days. Stripe transaction
records and limited operational/security logs are separate. The public deletion
resource is `/privacy#delete-account`, with an Account link and support email.

## Deployment

1. Back up production `/var/www/wikiracr/app.db` with SQLite's backup API, plus the current code
   and configuration. Preserve the live `pairs.db`; do not upload an older local
   dataset. Do not compare `.env` hashes.
2. Deploy the alerts relay with `/erase` first. Verify View Channel and Read Message
   History for WikiRacr's channels and the shared channels. Keep `ALERTS_URL` and
   `ALERTS_SECRET` configured while old account alerts exist.
3. Configure a Clerk webhook for `user.deleted` at
   `https://wikiracr.com/api/clerk/webhook` and put its signing secret in
   `CLERK_WEBHOOK_SIGNING_SECRET`. This also queues cleanup if someone deletes their
   identity through Clerk's profile panel. Signatures use Clerk's official helper
   and its Svix peer dependency; unsigned or stale events are rejected.
4. Deploy the server and client. The job table is created during normal database
   initialization; no separate migration or worker service is needed.
5. Use a new, explicitly disposable account to verify confirmation, API lockout,
   subscription cancellation, provider cleanup and removal of game records. Confirm
   that an unrelated player's records remain. Never delete Nic's account or use a
   real customer as a fixture. Do not start a paid subscription without approval.

Local tests use in-memory SQLite, mocked providers and headless browser fixtures.
They do not establish that production Clerk webhooks or billing are configured.
