# Uno Realtime Constitution

## Core Principles

### I. Server-Authoritative Game State
The server is the single source of truth for deck, hands, discard pile, turn
order, and direction. Clients never compute game logic locally beyond
optimistic UI; every move (play card, draw, call Uno, choose color) is
validated server-side against the current game state before it is applied
and broadcast. A player's hand is only ever sent to that player — other
players receive counts, never card values. This prevents cheating in a
casual friends-only game and keeps clients simple.

### II. Realtime-First, HTTP for the Rest
Gameplay events (join, play, draw, turn change, chat) go over WebSockets
(Socket.IO). Anything that isn't latency-sensitive (creating a room,
fetching past game history/stats) uses plain REST. Don't invent a third
transport.

### III. Simplicity & YAGNI
Build the classic 108-card ruleset first (numbers, Skip, Reverse, Draw Two,
Wild, Wild Draw Four, Uno-call + challenge). The 112-card variant (Swap
Hands / Shuffle Hands / house-rule blank cards) is an optional add-on
behind a room setting, not a blocker for MVP. No accounts/auth system
beyond a display name + room code unless a later spec calls for it. No
microservices, no message queue, no Redis — a single Node process handles
the in-memory game state for the small number of concurrent rooms this app
will realistically see.

### IV. Test What Can Break a Game
Unit tests are mandatory for the pure game-rules engine (deck building,
shuffling determinism where relevant, move validation, turn/direction
resolution, scoring) since bugs there ruin a live game. Integration/socket
tests cover the core multiplayer flows (join room, play, draw, disconnect
mid-game). UI polish and styling are not test-gated.

### V. Free-Tier Deployable by Design
Every technical choice must run on the free tiers of the target platforms
(see Technology Constraints). No feature may require a paid add-on,
persistent Redis, or a service with no free tier as a hard dependency.
Reconnect/resume logic must tolerate a free-tier backend that sleeps or
restarts (persist enough room state in MongoDB to survive a process
restart within a game).

## Technology Constraints

- **Backend**: Node.js + Express + Socket.IO.
- **Frontend**: React (Vite).
- **Database**: MongoDB Atlas (free M0 tier) via Mongoose, used for room/game
  persistence, reconnection, and post-game history — not as a hot path for
  every card move (authoritative state lives in server memory during an
  active game, checkpointed to Mongo on state-changing events).
- **Hosting targets (free tier)**: backend on Render (or Railway/Fly.io free
  tier) as a single web service; frontend on Vercel or Netlify; database on
  MongoDB Atlas free cluster. Deployment docs must name one concrete choice,
  not a menu.
- **No paid services** may be required for the app to function end-to-end.

## Development Workflow

- Spec → Plan → Tasks → Implementation, per SpecKit. Each feature gets its
  own `specs/NNN-name/` directory.
- Small, focused commits; game-rules engine changes always ship with tests.
- A change to card rules or scoring must reference the relevant section of
  the rules doc in the spec/PR description.

## Governance

This constitution supersedes ad-hoc practice for this repo. Amendments
require updating this file with a version bump and a one-line rationale in
the commit message. Any plan that deviates from a principle above must
justify it in that plan's Complexity Tracking section.

**Version**: 1.0.0 | **Ratified**: 2026-09-20 | **Last Amended**: 2026-09-20
