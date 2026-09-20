# Phase 0 Research: Realtime Multiplayer Uno

## Realtime transport: Socket.IO vs raw WebSocket vs a hosted realtime service

**Decision**: Socket.IO.

**Rationale**: Built-in room support (maps directly onto our `Room`
entity), automatic reconnection with a session-resume handshake we can
hook FR-013 into, and graceful fallback if a friend is on a restrictive
network. Raw `ws` would mean re-implementing rooms and reconnection by
hand; hosted services (Pusher, Ably) have free tiers but add an external
dependency and a message-count ceiling that a card-by-card game could hit
faster than expected, working against Constitution Principle V's "no
required paid service" and "no unnecessary dependency" (Principle III).

**Alternatives considered**: raw `ws` (more boilerplate for no real
benefit at this scale); Ably/Pusher (extra external free-tier account to
manage, usage caps not worth it for a self-hosted Socket.IO that's already
free).

## Free hosting for a stateful WebSocket backend

**Decision**: Render free Web Service.

**Rationale**: Render's free tier runs a persistent Node process capable
of holding WebSocket connections and in-memory room state, which serverless
platforms (Vercel/Netlify Functions) cannot do (no long-lived connections,
no shared memory across invocations). Cold start after 15 minutes idle is
the tradeoff, mitigated by the deployment plan's health-check/"waking up"
UI and by MongoDB-backed state recovery.

**Alternatives considered**: Vercel/Netlify serverless functions
(incompatible with persistent Socket.IO connections and in-memory state);
Fly.io free allowance (viable alternative, kept as a documented fallback
in plan.md if Render's free tier changes); Railway (historically had a
free tier but has moved to trial-credit-only, so not chosen as the
documented default).

## Database: MongoDB Atlas free tier usage pattern

**Decision**: MongoDB is a checkpoint/recovery + history store, not the
per-move hot path. Server keeps authoritative state in memory; it writes
to Mongo after each turn-resolving action (a card played, a draw that ends
the turn, a round ending) — not on every socket message (e.g. not on
cursor/typing-style chatter, since this app has none, but the principle
carries to any future ephemeral events).

**Rationale**: Atlas M0 has connection and storage limits; batching writes
to once-per-turn keeps well within them even for several simultaneous
rooms, satisfies FR-012 (crash recovery), and avoids adding write latency
to the player-facing move loop (which is served from memory first, then
persisted).

**Alternatives considered**: writing every socket event to Mongo (simplest
but adds latency to every move and risks hitting free-tier connection
limits under multiple concurrent rooms); using MongoDB Atlas's free-tier
built-in change streams for broadcasting (unnecessary — Socket.IO already
broadcasts in-process; would add complexity for no benefit at this scale).

## Move-legality & Wild Draw Four challenge implementation

**Decision**: Represent "current legality" as a pure function
`isLegalPlay(hand, card, topCard, activeColor)`, and implement the Wild
Draw Four challenge by having the server always compute whether the
*player who played it* had any legal alternative at the moment of play,
storing that boolean on the pending-challenge state so a later challenge
just looks it up (rather than re-deriving it from a possibly-changed
hand).

**Rationale**: Keeps the engine deterministic and testable per
Constitution Principle IV; avoids a race where the player draws/plays
again before a challenge resolves.

## Deck variants (108 vs 112 cards)

**Decision**: `buildDeck(options: { includeSwapOrShuffle?: 'swap' |
'shuffle'; customizableCount?: 0-3 })` as a single parameterized builder,
defaulting to the classic 108-card deck with no options set.

**Rationale**: Matches spec User Story 3 (P3, additive) without
special-casing two separate deck builders; the core rules engine
(`rules.ts`) only needs to know about card *types*, not which deck variant
produced them.
