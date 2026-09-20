# REST Contract

Non-realtime endpoints only (Constitution Principle II).

## `POST /api/users` (first-login identity capture, FR-019/020)
Creates a `User`, or matches one by email if it already exists. No
password, no verification (spec.md Assumptions).

Request: `{ name: string, email: string }`

Response `200`/`201`: `{ userId: string, name: string, email: string, stats: { gamesPlayed, gamesWon, totalScore } }`

Response `400`: malformed email.

## `GET /api/users/:id/stats`
Fetch a user's persisted stats (e.g. for a profile/summary display).

Response `200`: `{ name: string, stats: { gamesPlayed, gamesWon, totalScore } }`

Response `404`: unknown `userId`.

## `POST /api/rooms`
Create a room. `userId` is the identity from `POST /api/users`, linking
the host's seat to their persistent `User` record.

Request: `{ userId: string, hostDisplayName: string, settings?: Partial<RoomSettings> }`

Response `201`: `{ roomCode: string, playerId: string, joinUrl: string }`

## `POST /api/rooms/:code/join` (pre-flight validation; actual join happens over the socket)
Checks a room exists and can be joined before the client opens a socket.

Response `200`: `{ status: 'lobby' | 'in_progress' | 'full' | 'not_found' }`

## `GET /api/rooms/:code/results`
Match history for a room (post-game scoreboard).

Response `200`: `{ rounds: RoundResult[], matchScores: { playerId, displayName, total }[] }`

## `GET /api/health`
Liveness check, used by the frontend's "waking up the server" indicator
(plan.md Deployment Plan step 4).

Response `200`: `{ status: 'ok' }`
