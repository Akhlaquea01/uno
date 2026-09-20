# Quickstart: Realtime Multiplayer Uno

## Local development

```bash
npm install                       # installs all workspaces
cp backend/.env.example backend/.env   # set MONGODB_URI (Atlas or local mongod)
npm run dev -w backend            # starts API + Socket.IO on :4000
npm run dev -w frontend           # starts Vite dev server on :5173 (proxies to :4000)
```

Open two browser windows at `http://localhost:5173`; each is prompted for
a name + email on first load (identity capture), then create a room in
one, join with the room code in the other, start the game once both are
in the lobby.

To run it the way it deploys (single container), build and run the
Docker image instead:

```bash
docker build -t uno .
docker run -p 4000:4000 --env MONGODB_URI=... uno   # http://localhost:4000
```

## Tests

```bash
npm run test -w backend           # Vitest: game engine unit tests + socket integration tests
npm run test -w frontend          # component/hook tests
```

## Manual end-to-end check (matches spec Success Criteria)

1. Clear browser storage, load the app, confirm the name+email prompt
   blocks the Home screen; submit it, confirm a `User` document now
   exists in MongoDB, reload and confirm the prompt does not reappear.
2. Create a room, copy the join link, open it in a second (private/
   incognito) browser window, join with a different name.
3. Start the game with 2 players; confirm 7 cards each and a valid
   starting discard card.
4. Play through several turns covering: a number match, a color-only
   match, a Skip, a Reverse, a Draw Two, a Wild, and a Wild Draw Four
   (including triggering a challenge).
5. Get one player down to one card and confirm the "UNO!" prompt; let the
   window elapse without declaring and confirm another player can call it
   out for the 2-card penalty.
6. Play to a hand of zero cards; confirm the round-summary screen shows
   correct scores per the point table in the spec, and that both players'
   `User.stats` updated in MongoDB.
7. Kill the network on one client mid-round, reopen the join link within
   the grace period, confirm hand/turn state is intact.
8. Restart the backend process mid-round (simulating a free-tier
   redeploy/restart) and confirm the room recovers from MongoDB.

## Deploying (see plan.md "Deployment Plan" for details)

1. MongoDB Atlas free M0 cluster → `MONGODB_URI`.
2. `docker build -t uno .` from the repo root (builds frontend + backend
   into one image).
3. Render: one free Web Service, Docker runtime, pointed at the repo
   (Render builds the same `Dockerfile`). Env vars: `MONGODB_URI`, `PORT`.
   One URL serves the whole app — no separate frontend deployment.
