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
      `contracts/socket-events.md` and `contracts/rest-api.md` (Card,
      Color, CardType, User, Room, Game client-view, all event/REST
      payload interfaces)
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
      orchestrates start-game (deal, seed discard, first-card rules) and
      every subsequent action as a single MongoDB
      read-validate-`findOneAndUpdate(version)` round trip wrapping
      `rules.ts` calls (research.md direct-Mongo decision, data-model.md
      `version` field) — no in-memory game state, computes round-end and
      match-end transitions (depends on T023-T027, T011)
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
- [ ] T034 [US1] `frontend`: Game page, built landscape-first (Constitution
      Principle VI) — discard pile centered, player list with card counts
      + turn indicator along the top, in `frontend/src/pages/Game.tsx`
- [ ] T035 [P] [US1] `frontend`: `Hand` + `Card` components (own hand,
      click-to-play, color picker for Wilds) in
      `frontend/src/components/Hand.tsx`, `Card.tsx`
- [ ] T036 [P] [US1] `frontend`: Draw-pile button + "UNO!" button +
      catch-uno control in `frontend/src/components/GameControls.tsx`
- [ ] T037 [US1] `frontend`: `useGameState` hook wiring socket events to
      React state (depends on T014, T008)
- [ ] T038 [US1] `frontend`: RoundSummary page showing scores in
      `frontend/src/pages/RoundSummary.tsx`
- [ ] T039 [P] [US1] `frontend`: `useOrientation` hook
      (`matchMedia('(orientation: portrait)')` detection, research.md
      landscape-first decision) in `frontend/src/hooks/useOrientation.ts`
- [ ] T040 [US1] `frontend`: `OrientationGate` full-screen "rotate your
      device" overlay for small-screen portrait viewports, wrapping
      `Game.tsx`, plus the horizontal-scroll-strip hand layout for
      landscape (depends on T034, T035, T039)

**Checkpoint**: User Story 1 fully playable end-to-end (quickstart.md
steps 1-5 pass manually).

---

## Phase 4: User Story 2 - First-login identity capture and persistent stats (Priority: P1)

**Goal**: A new browser is asked for name + email before it can reach the
Home screen; that identity is a `User` document in MongoDB, matched by
email on return visits, and updated with stats at round/match end (spec
Acceptance Scenarios 1-5).

**Independent Test**: Clear storage, load the app, confirm the identity
form blocks Home until submitted, confirm a `User` doc exists in MongoDB,
reload and confirm the form doesn't reappear, play a round and confirm
stats updated.

### Tests for User Story 2

- [ ] T041 [P] [US2] Unit test: user upsert-by-email (new email creates a
      `User`; existing email returns the same `_id` and refreshes `name`)
      in `backend/tests/unit/userService.test.ts`
- [ ] T042 [P] [US2] Integration test: `POST /api/users` twice with the
      same email returns the same `userId`; a malformed email is rejected
      with 400, in `backend/tests/integration/identity.test.ts`
- [ ] T043 [US2] Integration test: finishing a round updates the seated
      players' `User.stats` (gamesPlayed/gamesWon/totalScore) in MongoDB,
      in `backend/tests/integration/identity-stats.test.ts`

### Implementation for User Story 2

- [ ] T044 [US2] Implement `backend/src/models/User.ts` Mongoose schema
      (`name`, unique-indexed `email`, `stats`) per `data-model.md`
- [ ] T045 [US2] Implement `backend/src/services/UserService.ts`:
      upsert-by-email, stats-update helper (depends on T044)
- [ ] T046 [US2] Implement `POST /api/users` and `GET /api/users/:id/stats`
      in `backend/src/routes/users.ts` (depends on T045)
- [ ] T047 [US2] Wire `GameService` round/match-end to call
      `UserService`'s stats update for every seated player's `userId`
      (depends on T045, T028)
- [ ] T048 [US2] Thread `userId` through `RoomService`/`room:join` so each
      `Player` seat links back to its `User` (depends on T013, T045)
- [ ] T049 [P] [US2] `frontend`: `IdentityGate` component — first-visit
      modal for name + email, calls `POST /api/users`, stores
      `{ userId, name, email }` in `localStorage`, wraps the app so
      Home/Lobby/Game are unreachable until identity exists, in
      `frontend/src/components/IdentityGate.tsx` (depends on T015)

**Checkpoint**: User Stories 1 AND 2 both work — a new browser must
identify itself before playing, and MongoDB tracks its stats across
sessions.

---

## Phase 5: User Story 3 - Reconnect after a dropped connection (Priority: P2)

**Goal**: A disconnected player resumes their seat/hand within the grace
period without disrupting the table (spec Acceptance Scenarios 1-3).

**Independent Test**: quickstart.md step 6.

### Tests for User Story 3

- [ ] T050 [P] [US3] Socket integration test: client disconnects mid-game,
      reconnects with stored `playerId` within grace period, receives
      correct hand/turn state, in
      `backend/tests/integration/reconnect.test.ts`
- [ ] T051 [P] [US3] Socket integration test: grace period elapses without
      reconnection → turn auto-skips/auto-draws and play continues, in
      `backend/tests/integration/reconnect-timeout.test.ts`

### Implementation for User Story 3

- [ ] T052 [US3] Extend `RoomService`/`GameService` with grace-period timer
      per disconnected player (`settings.reconnectGraceSeconds`), emitting
      `player:presence` and auto-skip/auto-draw on timeout (depends on
      T013, T028)
- [ ] T053 [US3] Persist `playerId` client-side (`localStorage`) and send
      it on `room:join` for reconnect attempts, in
      `frontend/src/services/socket.ts` (depends on T014)
- [ ] T054 [US3] `frontend`: "reconnecting..." indicator per player in
      `PlayerList`/`Game.tsx` (depends on T034)
- [ ] T055 [US3] Integration test proving FR-012 recovery: kill and
      restart the backend process mid-round; since MongoDB is the only
      copy of game state (no in-memory store to rehydrate), the next
      request against the room simply continues from the persisted
      document — assert this in
      `backend/tests/integration/restart-recovery.test.ts` (depends on
      T012, T028)

**Checkpoint**: User Stories 1, 2, AND 3 all work; a killed backend
process recovers in-progress rooms from MongoDB on restart.

---

## Phase 6: User Story 4 - House rules and the 112-card variant (Priority: P3)

**Goal**: Host can enable the extra Wild cards and 2-player house rules
before starting a game (spec Acceptance Scenarios 1-2).

**Independent Test**: quickstart.md manual variant check (not covered by
the base quickstart steps — toggle settings, start, inspect deck).

### Tests for User Story 4

- [ ] T056 [P] [US4] Unit test: `buildDeck({ includeSwapOrShuffle: 'swap',
      customizableCount: 3 })` yields a 112-card deck with the right card
      mix, in `backend/tests/unit/deck.test.ts`
- [ ] T057 [P] [US4] Unit test: 2-player house rules — Reverse acts as
      Skip, Draw Two/Four returns turn to the drawer's opponent, in
      `backend/tests/unit/rules.test.ts`

### Implementation for User Story 4

- [ ] T058 [US4] Extend `deck.ts` to build the 112-card variant (Swap
      Hands / Shuffle Hands / Customizable cards) per research.md
- [ ] T059 [US4] Implement Wild Swap Hands and Wild Shuffle Hands effects
      in `rules.ts`
- [ ] T060 [US4] Implement 2-player house-rule branch in `rules.ts`
      (Reverse-as-Skip, immediate turn return after forced draws)
- [ ] T061 [P] [US4] `frontend`: room-settings form (variant toggle,
      customizable card text inputs, 2-player house rules) in
      `frontend/src/pages/Lobby.tsx`

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T062 [P] Error boundary + toast/inline display for `game:error` in
      the frontend
- [ ] T063 [P] `GET /api/health`-based "waking up the server" indicator on
      `Home.tsx` (plan.md deployment cold-start mitigation)
- [ ] T064 Render deployment: `render.yaml` or dashboard config per
      plan.md Deployment Plan step 2
- [ ] T065 Vercel deployment: `frontend/vercel.json` (or dashboard config)
      per plan.md Deployment Plan step 3
- [ ] T066 [P] Mobile-responsive layout pass on `Game.tsx`/`Hand.tsx`
      (target audience plays on phones)
- [ ] T067 Run quickstart.md end-to-end manually against the deployed
      free-tier instances before calling MVP done

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks all user
  stories.
- **US1 (Phase 3)** has no dependency on US2/US3/US4 and is the core game
  loop.
- **US2 (Phase 4, Identity & Stats)** only needs Phase 2's REST scaffold
  (T012, T015); it doesn't depend on US1's game logic. Per spec FR-019 it
  must ship *before* the app is usable at all (it gates the Home screen),
  so treat Phases 3+4 together as the real MVP even though they're
  independently buildable/testable in either order.
- **US3 (Phase 5, Reconnect)** depends on US1's `GameService`/socket
  handlers existing (extends them) but is independently testable once
  present.
- **US4 (Phase 6, House rules)** depends on Phase 2's `deck.ts`/`rules.ts`
  skeletons but not on US2/US3; can be built in parallel with either by a
  second contributor.
- **Polish (Phase 7)** depends on US1+US2 at minimum; deployment tasks
  (T064-T065) can happen as soon as both checkpoints are reached, ahead of
  US3/US4, to get a demoable link out early.

## Implementation Strategy

**MVP first**: Phases 1-4 (Setup, Foundational, core game, identity &
stats) → deploy (T064-T065) → demo to friends before building
reconnection/variant polish. This matches the constitution's Simplicity
principle and gets real feedback on the core loop fastest.
