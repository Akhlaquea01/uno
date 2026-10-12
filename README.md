# Uno Realtime

Realtime multiplayer Uno for small private friend groups. See
[`specs/001-uno-realtime-multiplayer/`](specs/001-uno-realtime-multiplayer/)
for the full spec, plan, and task breakdown (built with
[Spec Kit](https://github.com/github/spec-kit)).

## Stack

- **Backend**: Node.js + Express + Socket.IO + Mongoose (TypeScript)
- **Frontend**: React + Vite (TypeScript)
- **Database**: MongoDB Atlas (free tier) — the only store of game state
- **Deployment**: one Docker image (frontend + backend), single free
  Render Web Service

## Local development

```bash
npm install                            # installs all workspaces
cp backend/.env.example backend/.env   # set MONGODB_URI (Atlas or local mongod)
npm run dev:backend                    # API + Socket.IO on :4000
npm run dev:frontend                   # Vite dev server on :5173 (proxies /api, /socket.io to :4000)
```

Open `http://localhost:5173` in two browser windows to play. See
[`specs/001-uno-realtime-multiplayer/quickstart.md`](specs/001-uno-realtime-multiplayer/quickstart.md)
for the full manual test script and the single-container Docker/Render
deployment steps.

## Tests

```bash
npm test
```

## Building / running the production container

```bash
docker build -t uno .
docker run -p 4000:4000 --env MONGODB_URI="..." uno
```

## Android app (APK)

The Android project lives at `frontend/android/`, generated with
[Capacitor](https://capacitorjs.com/). The app's WebView loads your **deployed
server** (see `frontend/capacitor.config.ts`) rather than a bundled copy of the
frontend: the game is a realtime Socket.IO client that needs the same origin as
the browser build, and every UI fix you deploy reaches installed apps without
a new APK. On top of that the app adds what a browser can't:

- full-screen immersive display (no URL bar or system bars), screen kept awake
- landscape lock (either way up) on the game table only; menus stay portrait-friendly
- a branded "Can't reach the server" page with a Try again button when offline
- Uno icon and splash screen

### Get an APK without installing anything (recommended)

GitHub's runners already have the Android SDK, so the build runs there:

1. In the repo: **Settings → Secrets and variables → Actions → Variables**, add
   `UNO_SERVER_URL` = your deployed URL, e.g. `https://your-app.onrender.com`.
2. **Actions → Build Android APK → Run workflow** (you can also paste the URL into
   the `server_url` box instead of setting the variable).
3. When it finishes, download the `uno-apk` artifact and unzip it to get `uno.apk`.
   To get a shareable download link instead, push a tag such as `apk-v1.0.0`: the
   workflow attaches `uno.apk` to a GitHub Release.
4. Copy `uno.apk` to the phone, open it, and allow "install unknown apps" when asked.

The APK is debug-signed, which is fine for sideloading to friends. Publishing to
Google Play needs a release keystore (Android Studio: Build > Generate Signed
Bundle/APK).

### Build locally

Requirements: JDK 17+ and the Android SDK (easiest: install
[Android Studio](https://developer.android.com/studio)).

```bash
export CAPACITOR_SERVER_URL="https://your-app.onrender.com"   # required
cd frontend
npm run android:apk
# -> frontend/android/app/build/outputs/apk/debug/app-debug.apk

# or open the project in Android Studio instead:
npm run android:open
```

`CAPACITOR_SERVER_URL` is required on purpose: without it `cap sync` fails
instead of producing an app that loads a placeholder address. Changes to the web
UI only need a redeploy; changes under `frontend/android/` or
`frontend/capacitor.config.ts` need a new APK.
