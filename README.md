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

## Building the Android APK

The Android project lives at `frontend/android/`, generated with
[Capacitor](https://capacitorjs.com/). Its WebView is pointed at your deployed
server URL (see `frontend/capacitor.config.ts`) rather than a bundled copy of
the frontend — the app is a realtime Socket.IO client, so it needs to talk to
the same origin the browser build does, and this way the app also always
serves the latest deployed frontend without needing a new APK build.

Requirements on your machine (not available in this sandbox): a JDK (17+) and
the Android SDK (easiest: install [Android Studio](https://developer.android.com/studio)).

```bash
# 1. Point the WebView at your deployed Render URL
export CAPACITOR_SERVER_URL="https://your-app.onrender.com"

# 2. Build the web app and sync it into the Android project
cd frontend
npm run cap:sync

# 3a. Open in Android Studio and build/run from there, or:
npm run android:open

# 3b. Or build a debug APK from the command line:
npm run android:apk
# → frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

For a release build (signed, for distribution outside your own device), use
Android Studio's Build > Generate Signed Bundle/APK, or see Capacitor's
[Android deployment guide](https://capacitorjs.com/docs/android/deploying-to-google-play).
