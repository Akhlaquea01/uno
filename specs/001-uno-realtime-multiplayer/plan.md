# Implementation Plan: Realtime Multiplayer Uno

**Branch**: `001-uno-realtime-multiplayer` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-uno-realtime-multiplayer/spec.md`

## Summary

Build a browser-based, realtime multiplayer Uno game for small private
friend groups. A single Node/Express + Socket.IO server holds no separate
game-state cache: every accepted player action is a direct
read-validate-write against the room's document in MongoDB Atlas (free
tier), and the resulting state is broadcast to a React (Vite) client over
WebSockets. No auth beyond a display name + room code. The mobile game
screen is designed landscape-first. Deploy backend to Render's free web
service tier, frontend as a static site to Vercel, database on MongoDB
Atlas M0 — all $0/month.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS) end to end.

**Primary Dependencies**: Express, Socket.IO (server + client), Mongoose,
React 18, Vite, Zod (payload validation), nanoid (room codes).

**Storage**: MongoDB Atlas free (M0) cluster via Mongoose — the single
direct source of truth (no in-memory game cache). Collections: `rooms`,
`games` (current round state, one doc per room, `version` field for
optimistic concurrency), `roundResults`.

**Testing**: Vitest for the game-rules engine (pure functions) and
Socket.IO integration tests (`socket.io-client` against an in-memory test
server); no e2e browser tests in MVP.

**Target Platform**: Web (desktop + mobile browsers). Backend on Linux
container (Render free web service). Frontend static hosting (Vercel).

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
  ruleset (User Story 1+2); the 112-card variant (User Story 3) is a
  later, additive module behind a room-settings flag, not built into the
  core engine's assumptions.
- ✅ **IV. Test What Can Break a Game** — `backend/src/game/*.test.ts`
  covers deck build/deal, move legality, every Action card, Wild Draw Four
  challenge, scoring, and turn/direction resolution before any UI work
  depends on them.
- ✅ **V. Free-Tier Deployable** — stack chosen specifically for Render +
  Vercel + Atlas free tiers; no Redis/queue; MongoDB is the direct store
  for every accepted action (one write per turn-resolving action, not per
  socket message), so a Render restart or cold start loses nothing.
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
│   ├── models/               # Mongoose schemas: Room, Game, RoundResult
│   ├── sockets/               # Socket.IO event handlers (thin, call game/)
│   ├── routes/                # REST: rooms, results
│   ├── services/              # RoomService, GameService (orchestration + persistence)
│   └── server.ts
└── tests/
    ├── unit/                  # game/ engine tests (Vitest)
    └── integration/           # socket.io-client flow tests

frontend/
├── src/
│   ├── pages/                 # Home (create/join), Lobby, Game, RoundSummary
│   ├── components/             # Card, Hand, DiscardPile, PlayerList, UnoButton,
│   │                            # OrientationGate (landscape-first, rotate prompt)
│   ├── hooks/                  # useSocket, useGameState, useOrientation
│   ├── services/               # socket client, REST client
│   └── App.tsx
└── tests/
    └── unit/                   # component/hook tests

shared/
└── src/
    └── events.ts               # Shared TS types for Socket.IO event payloads
                                  # (imported by both backend and frontend)
```

**Structure Decision**: npm-workspaces monorepo (`backend/`, `frontend/`,
`shared/`) — Option 2 (web application) from the template, plus a `shared`
package so socket event payload types aren't duplicated and can't drift
between client and server. This directly serves Constitution Principle I:
a single shared `events.ts` is what makes "server validates every intent"
enforceable in TypeScript on both ends.

## Deployment Plan (free tier)

1. **MongoDB Atlas**: create free M0 cluster, one database `uno`, network
   access allow-list `0.0.0.0/0` (or Render's static egress IPs if
   available on free tier), connection string in `MONGODB_URI` env var.
2. **Backend → Render**: new Web Service from the `backend/` directory
   (or repo root with a build filter), build command
   `npm install && npm run build -w backend`, start command
   `npm run start -w backend`. Env vars: `MONGODB_URI`, `CORS_ORIGIN`
   (the Vercel frontend URL), `PORT` (Render sets this).
3. **Frontend → Vercel**: import repo, root directory `frontend/`, build
   command `npm run build`, output `dist/`. Env var `VITE_SERVER_URL`
   pointing at the Render backend URL.
4. **Cold start mitigation**: frontend pings `GET /api/health` on load and
   shows a "waking up the server" indicator until it responds, before
   letting the user create/join a room.

## Complexity Tracking

*No constitution violations — table intentionally empty.*
