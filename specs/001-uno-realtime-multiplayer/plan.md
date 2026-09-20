# Implementation Plan: Realtime Multiplayer Uno

**Branch**: `001-uno-realtime-multiplayer` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-uno-realtime-multiplayer/spec.md`

## Summary

Build a browser-based, realtime multiplayer Uno game for small private
friend groups. A single Node/Express + Socket.IO server holds no separate
game-state cache: every accepted player action is a direct
read-validate-write against the room's document in MongoDB Atlas (free
tier), and the resulting state is broadcast to a React (Vite) client over
WebSockets. Identity is a lightweight name+email capture on first login,
persisted in MongoDB for cross-session stats — no password, no real auth.
The mobile game screen is designed landscape-first. The frontend build and
backend are packaged into **one Docker image** (Express serves the static
frontend alongside the API/Socket.IO) and deployed as a single free
container on Render, with MongoDB Atlas M0 as the only other moving part
— all $0/month, and nothing for the user to host themselves.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) end to end.

**Primary Dependencies**: Express, Socket.IO (server + client), Mongoose,
React 18, Vite, Zod (payload validation), nanoid (room codes).

**Storage**: MongoDB Atlas free (M0) cluster via Mongoose — the single
direct source of truth (no in-memory game cache). Collections: `users`
(persistent identity + stats, unique index on `email`), `rooms`, `games`
(current round state, one doc per room, `version` field for optimistic
concurrency), `roundResults`.

**Testing**: Vitest for the game-rules engine (pure functions) and
Socket.IO integration tests (`socket.io-client` against an in-memory test
server); no e2e browser tests in MVP.

**Target Platform**: Web (desktop + mobile browsers). One Docker container
(Express serving the API, Socket.IO, and the built frontend as static
files) on Render's free Web Service tier — chosen over Vercel because
Vercel's serverless model has no persistent process for Socket.IO to run
in and doesn't host arbitrary Docker containers the way a stateful
realtime server needs.

**Project Type**: Web application (frontend + backend), monorepo with npm
workspaces.

**Performance Goals**: <500ms move-to-broadcast latency (SC-002); support
at least 10 concurrent rooms of up to 10 players each on a single free-tier
instance (small friend-group scale, not a load-bearing requirement).

**Constraints**: Must run entirely on free tiers (constitution Principle
V). Render's free web service spins down after ~15 min idle and cold-starts
on the next request — acceptable per spec Assumptions, mitigated by
reconnect/resume (FR-012/013) and a lightweight client-side "waking up the
server..." state.

**Scale/Scope**: Friend-group casual play; not designed for public
matchmaking or high concurrency.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. Server-Authoritative State** — all game logic lives in
  `backend/src/game/` pure functions invoked only server-side; sockets
  never trust client-submitted state, only client-submitted *intents*
  (e.g. `PLAY_CARD {cardId}`).
- ✅ **II. Realtime-First, HTTP for the Rest** — room creation
  (`POST /api/rooms`) and history (`GET /api/rooms/:code/results`) are
  REST; everything else (join, play, draw, chat, presence) is Socket.IO.
- ✅ **III. Simplicity & YAGNI** — MVP scope is the classic 108-card
  ruleset plus lightweight identity capture (User Stories 1-2); the
  112-card variant (User Story 4) is a later, additive module behind a
  room-settings flag, not built into the core engine's assumptions.
- ✅ **IV. Test What Can Break a Game** — `backend/src/game/*.test.ts`
  covers deck build/deal, move legality, every Action card, Wild Draw Four
  challenge, scoring, and turn/direction resolution before any UI work
  depends on them.
- ✅ **V. Free-Tier Deployable** — one Docker container on Render's free
  tier plus Atlas free tier is the entire stack, nothing else to host or
  pay for; no Redis/queue; MongoDB is the direct store for every accepted
  action (one write per turn-resolving action, not per socket message),
  so a Render restart or cold start loses nothing.
- ✅ **VI. Mobile Landscape-First** — `frontend/src/pages/Game.tsx` and its
  CSS are built landscape-first; a small-screen portrait viewport gets a
  rotate-device prompt (FR-018), never a hard orientation lock.

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-uno-realtime-multiplayer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output (REST + Socket.IO event contracts)
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── game/                # Pure, framework-free rules engine
│   │   ├── deck.ts           # Build/shuffle 108- or 112-card deck
│   │   ├── rules.ts          # Move legality, effects, turn/direction
│   │   ├── scoring.ts        # Round scoring per card-point table
│   │   └── types.ts
│   ├── models/               # Mongoose schemas: User, Room, Game, RoundResult
│   ├── sockets/               # Socket.IO event handlers (thin, call game/)
│   ├── routes/                # REST: users (identity), rooms, results
│   ├── services/              # UserService, RoomService, GameService (orchestration + persistence)
│   └── server.ts
└── tests/
    ├── unit/                  # game/ engine tests (Vitest)
    └── integration/           # socket.io-client flow tests

frontend/
├── src/
│   ├── pages/                 # Home (create/join), Lobby, Game, RoundSummary
│   ├── components/             # Card, Hand, DiscardPile, PlayerList, UnoButton,
│   │                            # OrientationGate (landscape-first, rotate prompt),
│   │                            # IdentityGate (first-login name+email capture)
│   ├── hooks/                  # useSocket, useGameState, useOrientation
│   ├── services/               # socket client, REST client
│   └── App.tsx
└── tests/
    └── unit/                   # component/hook tests

shared/
└── src/
    └── events.ts               # Shared TS types for Socket.IO event payloads
                                  # (imported by both backend and frontend)

Dockerfile                      # Multi-stage: build shared+frontend+backend,
                                  # final stage runs the backend, which serves
                                  # frontend/dist as static files (single image)
.dockerignore
```

**Structure Decision**: npm-workspaces monorepo (`backend/`, `frontend/`,
`shared/`) — Option 2 (web application) from the template, plus a `shared`
package so socket event payload types aren't duplicated and can't drift
between client and server. This directly serves Constitution Principle I:
a single shared `events.ts` is what makes "server validates every intent"
enforceable in TypeScript on both ends.

## Deployment Plan (single container, free tier)

1. **MongoDB Atlas**: create free M0 cluster, one database `uno`, network
   access allow-list `0.0.0.0/0` (Atlas free tier has no static-IP
   egress to allow-list against), connection string in `MONGODB_URI`.
2. **`Dockerfile` (repo root, multi-stage)**:
   - Stage `build`: install all workspaces, run `npm run build -w shared
     -w backend -w frontend` (frontend emits static assets to
     `frontend/dist`).
   - Stage `runtime`: copy `backend`'s compiled output + `node_modules`,
     copy `frontend/dist` into a path the backend serves as static files
     (e.g. `backend/public`), `CMD ["node", "dist/server.js"]`.
   - `backend/src/server.ts` serves `frontend/dist` via
     `express.static(...)` and falls back to `index.html` for
     client-side routes not matching `/api/*` or Socket.IO's path — this
     is what makes it one deployable unit instead of two services.
3. **Render**: one free **Web Service**, "Docker" runtime, pointed at the
   repo root `Dockerfile`. Env vars: `MONGODB_URI`, `PORT` (Render sets
   this; the server must read `process.env.PORT`). No `CORS_ORIGIN`/
   cross-origin config needed in production — frontend and API are
   served from the same origin. (`CORS_ORIGIN` is still used in local
   dev, where the Vite dev server on a different port talks to the
   backend directly — see quickstart.md.)
4. **Cold start mitigation**: on load, the frontend pings `GET /api/health`
   and shows a "waking up the server" indicator until it responds, before
   letting the user create/join a room (Render's free tier spins the
   container down after ~15 min idle).

## Complexity Tracking

*No constitution violations — table intentionally empty.*
