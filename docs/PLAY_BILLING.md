# Google Play subscriptions

WikiRacr Pro uses Stripe on the website and Google Play in Android. Nic approves
**US$5.99/month on Android**, versus US$4.99/month on the web. Dividing by 0.85
covers a 15% store fee before tax; the approved rounded price leaves about US$5.09.
The app displays Google's localized price, not a hard-coded dollar amount.

- Package: `com.wikiracr.app`
- Subscription: `wikiracr_pro`
- Auto-renewing base plan: `monthly`, billing period `P1M`
- No free trial, introductory offer or installment commitment is configured.
- Billing Library: `9.1.0`; server authentication: `google-auth-library`.

## Current rollout

The Publisher API verifies the internal draft containing version 1.0/code 1.
`wikiracr_pro` and its `monthly` base plan are created and read back ACTIVE,
with the approved US$5.99 price and Google's converted prices in 174 regions.
No future-region automatic availability, trial or special offer is configured.
Signed build 3 includes the latest UI and wording changes. Its upload remains
pending. Notification resources are created and read back. Server-only credentials,
stable encryption key and test-billing settings are staged and parsed successfully;
`PLAY_LIVE_APPROVED=false`. Existing environment values and databases are preserved.
One protected pre-Play environment backup is kept at
`/root/deploy-backups/wikiracr-play.env` for rollback.

Nic approves the billing deployment. GitHub run
https://github.com/Nic-Richard/wikiracr/actions/runs/39337321152 targets the already
pushed, CI-passing commit `84b32e7` and completes successfully after Production
approval. Console topic linkage/test and actual license-tester purchases remain
pending. Website legal publication accompanies the approved client rollout.
Do not publish a production release or enable live purchases just to test this code.

The existing shared Publisher identity is documented in
`C:\Projects\Employment\google_access.md`. Administrative credentials never go in
the client or Android project. Product creation is authorized at the approved price;
API/source commits and deployment still follow Nic's separate approval rules.

## Server configuration

Set these only on the server, preserving its existing environment and databases:

```text
PLAY_BILLING_ENABLED=true
PLAY_LIVE_APPROVED=false
PLAY_SERVICE_ACCOUNT=<service-account JSON with Android Publisher access>
PLAY_TOKEN_KEY=<64 hex characters from 32 cryptographically random bytes>
PLAY_RTDN_AUDIENCE=https://wikiracr.com/api/play/notify
PLAY_RTDN_EMAIL=wikiracr-rtdn-push@miscellary.iam.gserviceaccount.com
```

Keep the encryption key stable and backed up with server secrets. Rotating it
without re-encrypting stored receipts prevents reconciliation and cancellation.
It is separate from Clerk credentials. With billing disabled or incomplete config,
the app shows its Pro comparison but cannot start a purchase.

Verified notification resources in the shared `miscellary` Cloud project:

- Topic: `projects/miscellary/topics/wikiracr-play-rtdn`
- Subscription: `projects/miscellary/subscriptions/wikiracr-play-rtdn-api`
- Push identity: `wikiracr-rtdn-push@miscellary.iam.gserviceaccount.com`
- Endpoint and audience: `https://wikiracr.com/api/play/notify`

Google Play's notification publisher has Publisher on this topic. The Pub/Sub
service agent has Token Creator only on the dedicated push identity. No key is
created for that identity. Subscription readback verifies the endpoint, audience
and identity. No test message is published before the receiver is deployed.
Configure the topic in Play Console's real-time developer notifications, enable all notification
types and send a Console test after deployment. The endpoint requires a Google
ID token for the exact audience and verified push-account email; a token from
another Google account is rejected. Raw test notifications receive no Discord alert.

The API deploys through **Deploy API** on main, with Nic's Production confirmation.
The workflow preserves server secrets/data and takes a consistent database backup.
Deploy the website separately when approving updated privacy/terms and app prompts;
the API workflow does not publish the client build.

## Purchase and subscription handling

The API issues a keyed, pseudonymous account ID before checkout. Android passes it
as Google's obfuscated account ID. The server checks that ID, package, product,
monthly plan, state and expiry against Google's API. Client claims alone grant
nothing. Pending payments grant nothing. Existing Stripe subscribers cannot buy
another subscription from the Android upgrade screen; web checkout rejects an
active Play subscription.

Receipt tokens are encrypted in SQLite and their hashes cannot move between
accounts. The server persists access and updates Clerk before acknowledging the
purchase. A failed acknowledgement can be retried through Restore purchases.
Cancelled subscriptions retain paid time; grace-period access follows Google's
expiry; hold, pause, expiry and revocation do not grant access. REST and socket
authorization check stored Play expiry rather than trusting cached client metadata.

Authenticated notifications re-fetch Google's current state, including after a
missed client confirmation. A five-minute worker reconciles due records, so
notification delivery is not the sole source of expiry handling. Subscription
updates post through the existing Discord relay without receipt tokens. Raw push
payloads, private credentials and receipt tokens must not be logged.

Account deletion cancels Play's future payments before deleting receipts and
identity. It retains the pseudonymous account reference in the existing short-lived
cleanup receipt so a late purchase notification can still cancel billing without
recreating the account. Stripe and Play entitlement changes preserve the other
provider's active subscription. Google/Stripe may retain their own financial records.

## Validation before public release

Local tests mock providers and cover ownership, encrypted storage, replay, pending
payments, expiry/grace/cancellation, preservation of Stripe access, notification
recovery, push identity and deletion retries/late purchases. Headless fixtures cover
localized checkout display, restore and signed API verification. Android builds
compile the native bridge; none of these checks is a real purchase.

Use the Play-installed internal build and Nic's license-tester Google account for
a test-card purchase, restore, accelerated renewal, cancellation/expiry and refund
or revocation. Verify Pro updates on the server and Discord, and verify deletion
cancels only a fresh disposable account's subscription. Keep `PLAY_LIVE_APPROVED`
false until these checks pass and Nic approves accepting real payments.
