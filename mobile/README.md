# WikiRacr Android

The Android app packages the existing React client with Capacitor. Its home screen,
navigation and race controls adapt to a phone; race validation and rankings remain
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
- Package: `com.wikiracr.app`; initial version `1.0`, code `1`, target SDK 36.

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
Existing Pro entitlements work, but Android exposes no Stripe checkout or portal.

## Before distributing

- Deploy the server's exact `https://localhost` origin allowance for REST and
  Socket.IO through an approved GitHub deployment. The current production server
  does not yet include this change. Do not upload local environment files or databases.
- Complete Google sign-in, sign-out and account deletion on a physical phone.
  Hosted sign-in reaches the correct domain in the emulator, but its Cloudflare
  human check prevents completing that flow there.
- Check a real solo race, daily challenge and multiplayer room, including reconnect
  after backgrounding and Android Back. Fixture checks do not replace live checks.
- Complete the Play listing, declarations, reviewer access and testing setup.
  Upload the first bundle manually, then validate the internal release before rollout.
- Increment `versionCode` for each subsequent Play upload. No EAS build is needed.
