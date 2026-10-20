# WikiRacr Android

The Android app packages the existing React client with Capacitor. It opens the
website's Play menu with its original wording and animated/parallax background.
The menu fits the app viewport; information pages scroll within the phone safe area.
Android gravity-sensor input drives parallax relative to the phone's initial angle.
The canvas smooths sensor input between frames; tappable controls stay still and
touch dragging never drives parallax. Input is recalibrated on resume/rotation and
stopped when motion is disabled or the app is paused. Sensor data stays on the device. Reports use a top-layer
dialog so menu transforms cannot clip the form or keyboard-sized viewport.
Race controls adapt to a phone; race validation and rankings remain
server-authoritative. Articles run in a sandboxed iframe without access to the native bridge.

## Local builds

Install dependencies with `npm ci` in both `client/` and `mobile/`. The build script
uses the installed JDK 21 and Android SDK. It reads the public production Clerk key
from `client/.env` (`VITE_CLERK_PUBLISHABLE_KEY`) or the environment. No server secrets
belong in the app. Bundled assets connect to `https://wikiracr.com`.

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File mobile/build-android.ps1
powershell -ExecutionPolicy Bypass -File mobile/build-android.ps1 -AppBundle
node --test client/tests/*.test.mjs
node mobile/smoke.mjs
node mobile/smoke-android.mjs
```

The browser check needs Chrome. The Android check drives only an emulator running
the debug APK and uses fixture responses rather than real games or purchases.
Override `CHROME_PATH`, `ADB_PATH` or `ANDROID_SERIAL` as needed.

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Signed AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Package: `com.wikiracr.app`; version `1.0`, code `3`, target SDK 36.

## Signing and sign-in

The separate upload key is outside Git at
`C:\Projects\WikiRacing\keys\wikiracr-upload.p12`, alias `wikiracr-upload`.
Its password is stored in adjacent `upload-password.xml`, encrypted for Nic's
Windows user. The build reads it into process environment variables and restores
the environment afterward. Keep a secure portable backup of the key and password;
the Windows credential file alone is not portable.

Native sign-in uses Clerk's Android SDK and hosted authentication. The production
callback `clerk://com.wikiracr.app.callback` is registered in Clerk. Sessions stay
with the SDK; the article iframe cannot read them. Web authentication is unchanged.
Existing Pro entitlements work. Android uses Google Play for new subscriptions,
restore and subscription management; it exposes no Stripe checkout or portal.
See `../docs/PLAY_BILLING.md` for server setup and required purchase checks.

## Before distributing

- The server's exact `https://localhost` origin allowance is deployed and verified
  for REST and Socket.IO through GitHub run 39301095334. Future API changes use the
  manual GitHub workflow. Do not upload local environment files or databases.
- Complete Google sign-in, sign-out and account deletion on a physical phone.
  Hosted sign-in reaches the correct domain in the emulator, but its Cloudflare
  human check prevents completing that flow there.
- Check a real solo race, daily challenge and multiplayer room, including reconnect
  after backgrounding and Android Back. Fixture checks do not replace live checks.
- Complete the Play listing, declarations, reviewer access and testing setup.
  Draft copy, declaration worksheet and prepared assets are in `store/`.
  Build 1 is uploaded as an internal draft. Replace it with build 3 for the final
  UI and wording changes, then validate the internal release before rollout.
- Increment `versionCode` for each subsequent Play upload. No EAS build is needed.
- After public launch, set `data-play-url` on the app-prompt script in
  `client/index.html` to `https://play.google.com/store/apps/details?id=com.wikiracr.app`.
  Until then it stays blank. The prompt targets Android browsers only, excludes
  native/standalone apps and remembers dismissal for seven days.
