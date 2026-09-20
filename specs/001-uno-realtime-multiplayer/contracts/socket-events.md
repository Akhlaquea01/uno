# Socket.IO Event Contract

Types shared via `shared/src/events.ts`. Client → server events are
**intents**; the server validates and re-broadcasts resulting **state**
(Constitution Principle I — never trust a client-submitted state).

## Client → Server

| Event | Payload | Server behavior |
|---|---|---|
| `room:join` | `{ roomCode, playerId?, displayName }` | `playerId` present = reconnect attempt (FR-013); absent = new join. Rejects if room full/in-progress (unless reconnecting). |
| `room:start` | `{ roomCode }` | Only host; requires 2-10 players; deals hands, seeds discard pile, applies first-card rules (FR-004). |
| `game:play_card` | `{ roomCode, cardId, chosenColor? }` | Validated against `isLegalPlay`; `chosenColor` required iff card is a Wild variant. Rejected with `game:error` if illegal or out of turn. |
| `game:draw_card` | `{ roomCode }` | Only current turn player; draws one card, may immediately follow with `game:play_card` for that same card. |
| `game:call_uno` | `{ roomCode }` | Declares Uno for the calling player when they hold exactly one card. |
| `game:catch_uno` | `{ roomCode, targetPlayerId }` | Accuses `targetPlayerId` of an undeclared one-card hand; server applies the 2-card penalty if valid. |
| `game:challenge_wild_draw_four` | `{ roomCode }` | Resolves the pending challenge using the stored `hadLegalAlternative` flag (FR-006). |
| `room:next_round` | `{ roomCode }` | Host-only, available once `status === round_ended`. |

## Server → Client

| Event | Payload | Notes |
|---|---|---|
| `room:state` | `Room` (players' hands omitted) | Sent on any lobby/room-level change. |
| `game:state` | `Game` view **scoped to the recipient** — own `hand: Card[]`, everyone else as `handCount: number` | Sent after every accepted intent. |
| `game:round_ended` | `RoundResult` | Includes winner and per-player scores. |
| `game:match_ended` | `{ winnerId, finalScores }` | When a player's `matchScore` crosses `targetScore`. |
| `player:presence` | `{ playerId, connectionStatus }` | On disconnect/reconnect/grace-timeout. |
| `game:error` | `{ code, message }` | Any rejected intent (illegal move, out of turn, room full, etc). |

## Reconnection handshake

1. Client stores `playerId` (not the ephemeral `socketId`) in
   `localStorage` on first successful join.
2. On reopening the join link, client emits `room:join` with that
   `playerId`. Server matches it to an existing seat, rebinds the new
   `socketId`, sets `connectionStatus: 'connected'`, and replies with the
   full current `game:state` scoped to that player.
3. If no matching `playerId` (grace period elapsed and seat was reclaimed,
   or wrong room), server treats it as a fresh join per normal rules.
