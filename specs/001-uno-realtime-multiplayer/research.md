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

**Decision**: MongoDB is the single, direct store for room/game state —
no separate in-memory authoritative copy. Each accepted player action
(play, draw, call/catch Uno, challenge) does one
read-validate-mutate-`findOneAndUpdate` round trip against the room's
`games` document, guarded by a `version` field (optimistic concurrency:
the update only applies if `version` still matches what was read,
preventing two rapid double-clicks from both being applied). The updated
document is then broadcast over Socket.IO.

**Rationale**: The user explicitly wants one place holding the data
(MongoDB), not a duplicated in-memory model that has to be kept in sync
and rehydrated on restart — that duplication is unneeded complexity at
this project's scale (Constitution Principle III). A single Mongo
round-trip per action is well within Atlas M0's connection/throughput
limits for a handful of concurrent friend-group rooms, and Uno is a
turn-based game (seconds between actions, not frames-per-second), so the
extra tens-of-milliseconds latency versus an in-memory read is not
user-perceptible and still comfortably meets the <500ms broadcast target
(SC-002). It also makes crash/restart recovery (FR-012) automatic: there
is nothing to rehydrate, the next read simply comes from Mongo.

**Alternatives considered**: in-memory authoritative state checkpointed to
Mongo (rejected per explicit product direction — two sources of truth to
keep in sync, and rehydration-on-boot logic, for no real benefit at this
scale); MongoDB change streams for broadcasting (unnecessary — Socket.IO
already broadcasts in-process; would add complexity for no benefit here).

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

## Mobile orientation: landscape-first layout

**Decision**: Design `Game.tsx` for landscape phone dimensions first
(discard pile centered, hand as a horizontally scrollable strip along the
bottom, opponent avatars/counts along the top). Detect portrait on a
small screen via `matchMedia('(orientation: portrait)')` in a
`useOrientation` hook and show a full-screen "rotate your device" overlay
via an `OrientationGate` component — do not use the Screen Orientation
Lock API to force landscape.

**Rationale**: The target audience plays on phones held horizontally
(explicit product direction). The Screen Orientation Lock API requires
fullscreen mode on most browsers and is unsupported on iOS Safari, so a
soft prompt is the only cross-platform-reliable option. Desktop and
portrait still render a usable (if secondary) layout so the app isn't
broken for anyone who ignores the prompt.

**Alternatives considered**: CSS-only `@media (orientation: portrait)`
rotation trick (transforms the whole page 90°, which fights the browser's
own UI chrome and scroll behavior — worse UX than asking the user to
physically rotate); enforcing landscape via the Fullscreen + Orientation
Lock API combo (unreliable across browsers, adds a fullscreen requirement
most players won't expect from a casual card game link).

## Deck variants (108 vs 112 cards)

**Decision**: `buildDeck(options: { includeSwapOrShuffle?: 'swap' |
'shuffle'; customizableCount?: 0-3 })` as a single parameterized builder,
defaulting to the classic 108-card deck with no options set.

**Rationale**: Matches spec User Story 3 (P3, additive) without
special-casing two separate deck builders; the core rules engine
(`rules.ts`) only needs to know about card *types*, not which deck variant
produced them.
