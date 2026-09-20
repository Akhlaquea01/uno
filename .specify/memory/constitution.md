# Uno Realtime Constitution

## Core Principles

### I. Server-Authoritative Game State
MongoDB is the single, direct source of truth for deck, hands, discard
pile, turn order, and direction — the server does not keep a separate
in-memory copy of game state that could drift from it. Every move (play
card, draw, call Uno, choose color) is handled as one read-validate-write
against the room's MongoDB document before it is broadcast; clients never
compute game logic locally beyond optimistic UI. A player's hand is only
ever sent to that player — other players receive counts, never card
values. This prevents cheating in a casual friends-only game, keeps
clients simple, and means a server restart never loses game state because
there is nothing else to keep in sync.

### II. Realtime-First, HTTP for the Rest
Gameplay events (join, play, draw, turn change, chat) go over WebSockets
(Socket.IO). Anything that isn't latency-sensitive (creating a room,
fetching past game history/stats) uses plain REST. Don't invent a third
transport.

### III. Simplicity & YAGNI
Build the classic 108-card ruleset first (numbers, Skip, Reverse, Draw Two,
Wild, Wild Draw Four, Uno-call + challenge). The 112-card variant (Swap
Hands / Shuffle Hands / house-rule blank cards) is an optional add-on
behind a room setting, not a blocker for MVP. Identity is a lightweight
name+email profile captured once per browser to key persistent stats —
not a real auth system (no password, no verification, no sessions) unless
a later spec calls for it. No microservices, no message queue, no Redis,
and no separate in-memory game store — a single Node process reads and
writes game state directly in MongoDB for the small number of concurrent
rooms this app will realistically see.

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
restarts; since MongoDB is the only store of game state (Principle I),
a process restart loses nothing to recover.

### VI. Mobile Landscape-First
The primary play surface is a phone held in landscape orientation — design
the game screen for that layout first (discard pile centered, hand as a
horizontal scrollable row, opponents along the top), with portrait/desktop
as secondary, still-usable layouts rather than the primary target. Do not
hard-lock orientation via the Screen Orientation API (unreliable on iOS
Safari); prompt the player to rotate when the viewport is portrait on a
small screen instead.

## Technology Constraints

- **Backend**: Node.js + Express + Socket.IO.
- **Frontend**: React (Vite).
- **Database**: MongoDB Atlas (free M0 tier) via Mongoose — the single,
  direct store for room/game state, reconnection, and post-game history.
  Every accepted move is one read-validate-write against the room's
  document; there is no separate in-memory authoritative copy to keep in
  sync.
- **Hosting**: one Docker image containing both the built frontend (static
  files) and the backend (Express serves them, plus the API and
  Socket.IO), deployed as a single free container — no separate frontend
  host, no infrastructure of the user's own to manage. Database on
  MongoDB Atlas free cluster. Deployment docs must name one concrete
  platform for that container, not a menu.
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
