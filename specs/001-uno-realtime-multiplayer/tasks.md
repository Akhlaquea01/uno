---
description: "Task list for Realtime Multiplayer Uno"
---

# Tasks: Realtime Multiplayer Uno

**Input**: Design documents from `specs/001-uno-realtime-multiplayer/`

**Tests**: Included — the constitution mandates tests for the game-rules
engine and core multiplayer flows (Principle IV).

**Organization**: Grouped by user story so each is independently
implementable and demoable.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions
Monorepo per plan.md: `backend/src/`, `frontend/src/`, `shared/src/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Initialize npm workspaces monorepo (`package.json` root with
      `workspaces: ["backend","frontend","shared"]`)
- [ ] T002 Scaffold `shared/` TypeScript package with build config
- [ ] T003 Scaffold `backend/` (Express + TypeScript + tsx/nodemon dev
      script), `backend/.env.example` with `MONGODB_URI`, `PORT`,
      `CORS_ORIGIN`
- [ ] T004 Scaffold `frontend/` with Vite + React + TypeScript
- [ ] T005 [P] Configure ESLint + Prettier shared config at repo root
- [ ] T006 [P] Configure Vitest for `backend/` and `frontend/`
- [ ] T007 Add root `README.md` with the quickstart.md dev commands

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work starts until this phase is done.

- [ ] T008 Define shared wire types in `shared/src/events.ts` per
      `contracts/socket-events.md` (Card, Color, CardType, Room, Game
      client-view, all event payload interfaces)
- [ ] T009 [P] Implement `backend/src/game/types.ts` (engine-internal
      types per `data-model.md`)
- [ ] T010 [P] Implement `backend/src/game/deck.ts`: `buildDeck(options)`
      producing the classic 108-card deck by default (research.md deck
      variants decision) + Fisher-Yates shuffle
- [ ] T011 Implement `backend/src/models/Room.ts`,
      `backend/src/models/Game.ts`, `backend/src/models/RoundResult.ts`
      Mongoose schemas per `data-model.md`
- [ ] T012 Implement `backend/src/server.ts`: Express app + Socket.IO
      server bootstrap, CORS config, MongoDB connection, `GET /api/health`
- [ ] T013 Implement `backend/src/services/RoomService.ts`: create room
      (short unique code via nanoid), join/rejoin logic (reconnection
      handshake per `contracts/socket-events.md`), host-transfer on
      disconnect (FR-014)
- [ ] T014 [P] `frontend`: Socket.IO client wrapper in
      `frontend/src/services/socket.ts` and `useSocket` hook
- [ ] T015 [P] `frontend`: REST client in `frontend/src/services/api.ts`
      for `POST /api/rooms`, `GET /api/rooms/:code/join`,
      `GET /api/health`

**Checkpoint**: Server boots, connects to MongoDB, accepts a room
create/join round-trip with no game logic yet.

---

## Phase 3: User Story 1 - Create a room and play a full game (Priority: P1) 🎯 MVP

**Goal**: Two+ players can create/join a room and play a complete round to
a correct score screen, per spec Acceptance Scenarios 1-8.

**Independent Test**: quickstart.md steps 1-5.

### Tests for User Story 1

- [ ] T016 [P] [US1] Unit tests for `deck.ts` (deck size/composition,
      shuffle produces a permutation) in `backend/tests/unit/deck.test.ts`
- [ ] T017 [P] [US1] Unit tests for `backend/src/game/rules.ts`
      `isLegalPlay` covering: color match, number match, symbol match,
      Wild always legal, mismatch rejected — in
      `backend/tests/unit/rules.test.ts`
- [ ] T018 [P] [US1] Unit tests for every Action card effect (Skip,
      Reverse incl. direction flip, Draw Two forced draw + skip, Wild
      color choice, Wild Draw Four incl. challenge win/lose draw counts)
      in `backend/tests/unit/rules.test.ts`
- [ ] T019 [P] [US1] Unit tests for `backend/src/game/scoring.ts` against
      the point table in spec.md FR-010, in
      `backend/tests/unit/scoring.test.ts`
- [ ] T020 [P] [US1] Unit test for first-card-flip setup rules (Action
      card applies immediately, Wild lets first player choose color, Wild
      Draw Four reshuffled back in) in
      `backend/tests/unit/setup.test.ts`
- [ ] T021 [US1] Socket integration test: two clients join a room, host
      starts, each receives correctly-scoped `game:state` (own hand vs.
      others' counts) in `backend/tests/integration/join-and-start.test.ts`
- [ ] T022 [US1] Socket integration test: full round played
      programmatically to a zero-card hand, asserts `game:round_ended`
      payload matches expected scores, in
      `backend/tests/integration/full-round.test.ts`

### Implementation for User Story 1

- [ ] T023 [US1] Implement `backend/src/game/rules.ts`: `isLegalPlay`,
      `applyPlay` (mutates/returns next Game state incl. Action effects),
      turn/direction resolution (depends on T009, T010)
- [ ] T024 [US1] Implement `backend/src/game/scoring.ts`: round score
      calculation per FR-010 (depends on T009)
- [ ] T025 [US1] Implement draw-pile exhaustion reshuffle (FR-008) inside
      `rules.ts`'s draw handling
- [ ] T026 [US1] Implement Uno-call state machine (`pendingUnoCall` set/
      clear/catch + 2-card penalty, FR-009) in `rules.ts`
- [ ] T027 [US1] Implement Wild Draw Four challenge resolution
      (`pendingChallenge`, FR-006) in `rules.ts`
- [ ] T028 [US1] Implement `backend/src/services/GameService.ts`:
      orchestrates start-game (deal, seed discard, first-card rules),
      wraps `rules.ts` calls with Mongo checkpoint writes (research.md
      write-batching decision), computes round-end and match-end
      transitions (depends on T023-T027, T011)
- [ ] T029 [US1] Implement `backend/src/sockets/roomHandlers.ts`:
      `room:join`, `room:start` (depends on T013, T028)
- [ ] T030 [US1] Implement `backend/src/sockets/gameHandlers.ts`:
      `game:play_card`, `game:draw_card`, `game:call_uno`,
      `game:catch_uno`, `game:challenge_wild_draw_four`, emitting
      per-recipient scoped `game:state` and `game:error` (depends on T028)
- [ ] T031 [US1] Implement `POST /api/rooms`, `GET /api/rooms/:code/join`,
      `GET /api/rooms/:code/results` in `backend/src/routes/rooms.ts`
      (depends on T013)
- [ ] T032 [P] [US1] `frontend`: Home page (create/join form) in
      `frontend/src/pages/Home.tsx`
- [ ] T033 [P] [US1] `frontend`: Lobby page (player list, start button for
      host) in `frontend/src/pages/Lobby.tsx`
- [ ] T034 [US1] `frontend`: Game page — discard pile, current color,
      player list with card counts + turn indicator, in
      `frontend/src/pages/Game.tsx`
- [ ] T035 [P] [US1] `frontend`: `Hand` + `Card` components (own hand,
      click-to-play, color picker for Wilds) in
      `frontend/src/components/Hand.tsx`, `Card.tsx`
- [ ] T036 [P] [US1] `frontend`: Draw-pile button + "UNO!" button +
      catch-uno control in `frontend/src/components/GameControls.tsx`
- [ ] T037 [US1] `frontend`: `useGameState` hook wiring socket events to
      React state (depends on T014, T008)
- [ ] T038 [US1] `frontend`: RoundSummary page showing scores in
      `frontend/src/pages/RoundSummary.tsx`

**Checkpoint**: User Story 1 fully playable end-to-end (quickstart.md
steps 1-5 pass manually).

---

## Phase 4: User Story 2 - Reconnect after a dropped connection (Priority: P2)

**Goal**: A disconnected player resumes their seat/hand within the grace
period without disrupting the table (spec Acceptance Scenarios 1-3).

**Independent Test**: quickstart.md step 6.

### Tests for User Story 2

- [ ] T039 [P] [US2] Socket integration test: client disconnects mid-game,
      reconnects with stored `playerId` within grace period, receives
      correct hand/turn state, in
      `backend/tests/integration/reconnect.test.ts`
- [ ] T040 [P] [US2] Socket integration test: grace period elapses without
      reconnection → turn auto-skips/auto-draws and play continues, in
      `backend/tests/integration/reconnect-timeout.test.ts`

### Implementation for User Story 2

- [ ] T041 [US2] Extend `RoomService`/`GameService` with grace-period timer
      per disconnected player (`settings.reconnectGraceSeconds`), emitting
      `player:presence` and auto-skip/auto-draw on timeout (depends on
      T013, T028)
- [ ] T042 [US2] Persist `playerId` client-side (`localStorage`) and send
      it on `room:join` for reconnect attempts, in
      `frontend/src/services/socket.ts` (depends on T014)
- [ ] T043 [US2] `frontend`: "reconnecting..." indicator per player in
      `PlayerList`/`Game.tsx` (depends on T034)
- [ ] T044 [US2] Verify FR-012 recovery: on `server.ts` boot, rehydrate any
      `in_progress` `Game`/`Room` docs from MongoDB into memory (depends on
      T012, T011)

**Checkpoint**: User Stories 1 AND 2 both work; a killed backend process
recovers in-progress rooms from MongoDB on restart.

---

## Phase 5: User Story 3 - House rules and the 112-card variant (Priority: P3)

**Goal**: Host can enable the extra Wild cards and 2-player house rules
before starting a game (spec Acceptance Scenarios 1-2).

**Independent Test**: quickstart.md manual variant check (not covered by
the base quickstart steps — toggle settings, start, inspect deck).

### Tests for User Story 3

- [ ] T045 [P] [US3] Unit test: `buildDeck({ includeSwapOrShuffle: 'swap',
      customizableCount: 3 })` yields a 112-card deck with the right card
      mix, in `backend/tests/unit/deck.test.ts`
- [ ] T046 [P] [US3] Unit test: 2-player house rules — Reverse acts as
      Skip, Draw Two/Four returns turn to the drawer's opponent, in
      `backend/tests/unit/rules.test.ts`

### Implementation for User Story 3

- [ ] T047 [US3] Extend `deck.ts` to build the 112-card variant (Swap
      Hands / Shuffle Hands / Customizable cards) per research.md
- [ ] T048 [US3] Implement Wild Swap Hands and Wild Shuffle Hands effects
      in `rules.ts`
- [ ] T049 [US3] Implement 2-player house-rule branch in `rules.ts`
      (Reverse-as-Skip, immediate turn return after forced draws)
- [ ] T050 [P] [US3] `frontend`: room-settings form (variant toggle,
      customizable card text inputs, 2-player house rules) in
      `frontend/src/pages/Lobby.tsx`

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Error boundary + toast/inline display for `game:error` in
      the frontend
- [ ] T052 [P] `GET /api/health`-based "waking up the server" indicator on
      `Home.tsx` (plan.md deployment cold-start mitigation)
- [ ] T053 Render deployment: `render.yaml` or dashboard config per
      plan.md Deployment Plan step 2
- [ ] T054 Vercel deployment: `frontend/vercel.json` (or dashboard config)
      per plan.md Deployment Plan step 3
- [ ] T055 [P] Mobile-responsive layout pass on `Game.tsx`/`Hand.tsx`
      (target audience plays on phones)
- [ ] T056 Run quickstart.md end-to-end manually against the deployed
      free-tier instances before calling MVP done

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks all user
  stories.
- **US1 (Phase 3)** has no dependency on US2/US3 and is the MVP.
- **US2 (Phase 4)** depends on US1's `GameService`/socket handlers
  existing (extends them) but is independently testable once present.
- **US3 (Phase 5)** depends on Phase 2's `deck.ts`/`rules.ts` skeletons
  but not on US2; can be built in parallel with US2 by a second
  contributor.
- **Polish (Phase 6)** depends on US1 at minimum; deployment tasks
  (T053-T054) can happen as soon as US1's checkpoint is reached, ahead of
  US2/US3, to get a demoable link out early.

## Implementation Strategy

**MVP first**: Phases 1-3 only → deploy (T053-T054) → demo to friends
before building reconnection/variant polish. This matches the
constitution's Simplicity principle and gets real feedback on the core
loop fastest.
