# REST Contract

Non-realtime endpoints only (Constitution Principle II).

## `POST /api/rooms`
Create a room.

Request: `{ hostDisplayName: string, settings?: Partial<RoomSettings> }`

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
