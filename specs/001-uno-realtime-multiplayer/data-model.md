# Phase 1 Data Model: Realtime Multiplayer Uno

Types live in `shared/src/events.ts` (wire payloads) and
`backend/src/game/types.ts` (engine-internal); Mongoose schemas in
`backend/src/models/` persist the subset needed for recovery/history.

## Card

```ts
type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
type CardType =
  | { kind: 'number'; value: 0|1|2|3|4|5|6|7|8|9 }
  | { kind: 'skip' } | { kind: 'reverse' } | { kind: 'draw_two' }
  | { kind: 'wild' } | { kind: 'wild_draw_four' }
  | { kind: 'wild_swap_hands' } | { kind: 'wild_shuffle_hands' }
  | { kind: 'wild_customizable'; text: string };

interface Card { id: string; color: Color; type: CardType; }
```
Number/action cards carry a concrete `color`; the four Wild variants carry
`color: 'wild'` until played, at which point the *play* (not the card)
records the chosen color as `Game.activeColor`.

## User (persistent identity, MongoDB collection `users`)

- `_id`
- `name`
- `email` (unique index — the key used to recognize a returning player;
  no password/verification, see spec.md Assumptions)
- `createdAt`
- `stats: { gamesPlayed: number; gamesWon: number; totalScore: number }`
  — updated by `GameService` at round/match end (FR-021); MongoDB is the
  only copy, there is no client-side stats store.

Captured once per browser via the first-login flow (FR-019/020); the
resulting `_id` is stored client-side (`localStorage`) as `userId` and
sent on every subsequent room create/join so a `Player` seat can be linked
back to it.

## Player

- `id` (socket-independent, persists across reconnects — generated on
  first join, stored client-side e.g. in `localStorage`, sent back on
  reconnect)
- `userId` — references the seated person's `User._id` (see above); this
  is what makes stats persist across rooms and sessions, distinct from the
  room-scoped `id`
- `displayName`
- `socketId` (null while disconnected)
- `connectionStatus`: `connected | reconnecting | disconnected`
- `seat` (turn-order index, fixed once the game starts)
- `isHost`
- `matchScore` (running total across rounds, scoped to this room)
- `hand: Card[]` — **server-side only**, never serialized to other
  players; the player's own client receives their own hand.

## Room

- `code` (short, unique, human-shareable, e.g. 6 alphanumeric chars)
- `status`: `lobby | in_progress | round_ended | match_ended`
- `players: Player[]`
- `settings`: `{ targetScore: number; variant112: 'off'|'swap'|'shuffle';
  customizableCount: 0-3; customizableTexts: string[];
  twoPlayerHouseRules: boolean; reconnectGraceSeconds: number }`
- `createdAt`

## Game (one MongoDB document per in-progress room — the only copy of this state; no in-memory duplicate)

- `roomCode`
- `version: number` — incremented on every write; each action's
  `findOneAndUpdate` includes `{ version: expectedVersion }` in its filter
  so a stale/duplicate action (e.g. a double-click) fails instead of
  silently overwriting a newer state
- `deck: Card[]` (draw pile, server-only)
- `discardPile: Card[]` (top = last played)
- `activeColor: Color` (the color in effect, relevant when top card is Wild)
- `turnIndex: number`, `direction: 1 | -1`
- `pendingUnoCall: { playerId } | null` — set the instant a play leaves a
  player with exactly one card, cleared when they declare or are caught
- `pendingChallenge: { playerId; hadLegalAlternative: boolean } | null` —
  set when a Wild Draw Four is played, consumed by a challenge or by the
  next player's turn starting (which forfeits the challenge window)
- `updatedAt` (used for the "checkpoint after each turn-resolving action"
  write pattern from research.md)

## RoundResult (append-only history)

- `roomCode`, `roundNumber`
- `winnerId`
- `scores: { playerId, cardsLeftValue }[]`
- `endedAt`

## State transitions (Room.status)

`lobby --(host starts, 2-10 players)--> in_progress
in_progress --(a hand reaches 0)--> round_ended
round_ended --(host clicks "next round")--> in_progress
round_ended --(a player's matchScore ≥ targetScore)--> match_ended`

## Validation rules (enforced server-side, mirrors FR-005/006/017)

- A play is legal only if: `card.color === activeColor` OR
  `card matches discard top by type` (same kind/value) OR `card.color ===
  'wild'`.
- Wild Draw Four is only legal without challenge risk if the player holds
  no card matching `activeColor`; the server always records the truth of
  this at play time (see research.md) regardless of whether it's later
  challenged.
- Only `players[turnIndex]` may submit `PLAY_CARD` / `DRAW_CARD`; all
  other submissions are rejected with an error event, state unchanged.
