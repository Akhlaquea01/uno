# Quickstart: Realtime Multiplayer Uno

## Local development

```bash
npm install                       # installs all workspaces
cp backend/.env.example backend/.env   # set MONGODB_URI (Atlas or local mongod)
npm run dev -w backend            # starts API + Socket.IO on :4000
npm run dev -w frontend           # starts Vite dev server on :5173 (proxies to :4000)
```

Open two browser windows at `http://localhost:5173`, create a room in one,
join with the room code in the other, start the game once both are in the
lobby.

## Tests

```bash
npm run test -w backend           # Vitest: game engine unit tests + socket integration tests
npm run test -w frontend          # component/hook tests
```

## Manual end-to-end check (matches spec Success Criteria)

1. Create a room, copy the join link, open it in a second (private/
   incognito) browser window, join with a different name.
2. Start the game with 2 players; confirm 7 cards each and a valid
   starting discard card.
3. Play through several turns covering: a number match, a color-only
   match, a Skip, a Reverse, a Draw Two, a Wild, and a Wild Draw Four
   (including triggering a challenge).
4. Get one player down to one card and confirm the "UNO!" prompt; let the
   window elapse without declaring and confirm another player can call it
   out for the 2-card penalty.
5. Play to a hand of zero cards; confirm the round-summary screen shows
   correct scores per the point table in the spec.
6. Kill the network on one client mid-round, reopen the join link within
   the grace period, confirm hand/turn state is intact.
7. Restart the backend process mid-round (simulating a free-tier
   redeploy/restart) and confirm the room recovers from MongoDB.

## Deploying (see plan.md "Deployment Plan" for details)

1. MongoDB Atlas free M0 cluster → `MONGODB_URI`.
2. Backend → Render free Web Service (root `backend/`).
3. Frontend → Vercel (root `frontend/`), `VITE_SERVER_URL` = Render URL.
