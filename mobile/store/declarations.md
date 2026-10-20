# Play declarations - review draft

Prepared from Android code, Clerk, billing and the privacy policy. Final SDK/provider
review and Console answers remain necessary.

## Access and content

- No ads. Guest play and optional Clerk account. Provide dedicated production review
  access to account/Pro features; keep credentials out of Git. Never use Nic's account.
- Android subscriptions use Google Play, with no Stripe checkout or portal link.
  `wikiracr_pro/monthly` is ACTIVE at USD 5.99 with regional prices. Real payments
  stay disabled until license testing and approval.
- Account > Delete account; public instructions: https://wikiracr.com/privacy#delete-account.
  Cleanup cancels linked subscriptions and clears matching bot alerts.
- Accounts require age 13+. Complete the actual audience/IARC questions; Wikipedia
  can contain mature material. Multiplayer chat and reports are user-generated content.
- No location, camera, microphone, advertising-ID or remote-notification feature.
  Signed permissions: internet/network, biometric SDK permissions and Play Billing.

## Data inventory

| Flow / candidate category | Actual handling |
| --- | --- |
| Account / personal info and user IDs | Clerk and backend can process email, username/display name, account ID and profile image URL. Include native and hosted-auth processing. |
| Gameplay / app activity | Pairs, paths, clicks, times, scores, daily progress, rankings and room activity reach the server. Some results/profile fields are public. |
| Chat and reports / messages and user content | Messages go to room participants; optional reports carry text, context and signed-in identity. Reports/errors can reach the private Alerts relay. |
| Subscription / purchase history | Server encrypts Google purchase tokens and stores expiry and a pseudonymous account reference. Google handles payment-card entry. |
| Requests / diagnostics | Backend/hosting/auth logs can include IP address, request metadata, timestamps and failures. Review provider retention/sharing. |
| Motion | Optional gravity readings animate the background locally; no transmission or account storage. |

Use Google's actual collected/shared, required/optional, purpose and ephemeral
definitions. Provider exceptions require their conditions. Public leaderboards and
room chat are not private processing. Production uses HTTPS; no independent audit claimed.

## Release checks

- Replace the uploaded code 1 draft with local code 3 after approval.
- In Play Console, link `projects/miscellary/topics/wikiracr-play-rtdn`, enable all
  notification types and send its test. Direct authenticated Pub/Sub delivery passes,
  but does not prove Console linkage.
- Play-installed license testing: purchase, restore, renewal, cancellation/expiry,
  refund/revocation and disposable-account cleanup.
- Real-phone sign-in, solo/daily/multiplayer, reconnect, Back and report checks.

References: [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469),
[privacy policy](https://wikiracr.com/privacy), [billing setup](../../docs/PLAY_BILLING.md).
