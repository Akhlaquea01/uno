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
