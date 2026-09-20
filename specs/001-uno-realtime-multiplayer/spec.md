# Feature Specification: Realtime Multiplayer Uno

**Feature Branch**: `001-uno-realtime-multiplayer`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Realtime multiplayer Uno game to play with real friends, free-tier deployable, using MongoDB. Classic Uno rules (see rules doc). Data lives in MongoDB only (no separate in-memory store). Mobile play is landscape-first. On first login, capture name + email and persist stats against MongoDB."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a room and play a full game with friends (Priority: P1)

A player opens the site, enters a display name, creates a room and gets a
shareable room code/link. Friends open the link, enter their name, and join
the room's lobby. The host starts the game once 2-10 players have joined.
Each player is dealt 7 cards; the game proceeds turn by turn in real time —
players see the discard pile, whose turn it is, everyone's card counts, and
their own hand — until one player empties their hand and the round ends
with scores shown.

**Why this priority**: This is the entire product. Without it there is no
game.

**Independent Test**: Two browser sessions (or two devices) create/join one
room, play a full round to completion (someone reaches 0 cards), and see a
correct round-end score screen. Delivers the core value end-to-end.

**Acceptance Scenarios**:

1. **Given** a player on the home screen, **When** they create a room,
   **Then** they get a unique room code and land in a lobby as host.
2. **Given** a room code, **When** another player enters it with a display
   name, **Then** they appear in the lobby for all current members in real
   time.
3. **Given** a lobby with 2-10 players, **When** the host clicks Start,
   **Then** every player is dealt 7 cards, one card is flipped to start the
   discard pile, and turn order/direction is established per the rules for
   whatever card was flipped (Action card effect applies immediately, Wild
   Draw Four is reshuffled back in, Wild lets the first player pick a
   color).
4. **Given** it is a player's turn, **When** they play a card that matches
   the discard pile by color, number, or symbol, **Then** the card moves to
   the discard pile, its effect (if any) applies, and the turn advances per
   the current direction.
5. **Given** it is a player's turn and they have no playable card (or choose
   not to play one), **When** they draw, **Then** they receive one card
   from the draw pile; if it's playable they may play it immediately,
   otherwise their turn ends.
6. **Given** a player is reduced to one card by playing, **When** they do
   not click "UNO!" before the next player's turn begins, **Then** any
   other player can call them out, and they draw two penalty cards.
7. **Given** a player empties their hand, **When** their last card is
   played, **Then** the round ends immediately, scores are computed from
   every other player's remaining hand, and a round-summary screen is shown
   to all players.
8. **Given** the draw pile is empty and no one has won, **When** a player
   needs to draw, **Then** the discard pile (minus its top card) is
   reshuffled into a new draw pile.

---

### User Story 2 - First-login identity capture and persistent stats (Priority: P1)

The first time someone opens the app on a browser/device, before they can
create or join a room, they're asked for a display name and an email
address. That identity is created (or matched, if the email was seen
before) as a record in MongoDB, and every game they finish updates their
win/loss/score stats against that same record. On later visits from the
same browser, they are recognized automatically and go straight to
creating/joining a room.

**Why this priority**: Every player must pass through this before they can
play at all, and it's what makes "your stats" mean anything across more
than one sitting — without it every game is a throwaway. It gates User
Story 1's flow, so it ships alongside it.

**Independent Test**: Clear browser storage, open the app, confirm the
name+email prompt appears before any room UI; submit it and confirm a
`User` document now exists in MongoDB; reload the page and confirm the
prompt does not reappear; play a full round (User Story 1) and confirm the
`User` document's stats updated.

**Acceptance Scenarios**:

1. **Given** a browser with no stored identity, **When** the app loads,
   **Then** a name + email form is shown before the Home screen (room
   create/join) is reachable.
2. **Given** the identity form, **When** the player submits a name and a
   syntactically valid email, **Then** a `User` record is created in
   MongoDB (or matched by email if one already exists with that email),
   the identity is stored in the browser, and the player lands on the Home
   screen.
3. **Given** an email that already has a `User` record (e.g., the player
   cleared storage and re-entered the same email, or is on a new device),
   **When** they submit it, **Then** they are matched to the existing
   record and its accumulated stats, not a new one.
4. **Given** a returning visit from a browser with a stored identity,
   **When** the app loads, **Then** the identity prompt is skipped and the
   Home screen's display name is pre-filled from the stored identity.
5. **Given** an identified player who finishes a round or a full match,
   **When** the round/match ends, **Then** their `User` record's stats
   (games played, games won, total score) are updated in MongoDB.

---

### User Story 3 - Reconnect after a dropped connection (Priority: P2)

A player's phone locks or their WiFi blips mid-game. They reopen the room
link within a grace period and rejoin the same seat with their hand intact,
without disrupting the other players' game.

**Why this priority**: Realtime games over home WiFi/mobile networks will
see disconnects constantly; without this the product is unusable for its
target audience (friends on phones/laptops).

**Independent Test**: Start a game, force-disconnect one client (close
tab/kill network), reopen the room link as the same player within the
grace window, and confirm their hand, turn state, and the rest of the
table are unaffected.

**Acceptance Scenarios**:

1. **Given** a connected game, **When** a player's socket disconnects,
   **Then** other players see that player marked "reconnecting" (not
   removed) and, if it becomes their turn, an auto-skip/auto-draw only
   fires after a grace timeout.
2. **Given** a disconnected player, **When** they reopen the room link
   within the grace period, **Then** their session resumes with their
   current hand and it's their turn if it still is.
3. **Given** a disconnected player, **When** the grace period elapses
   without reconnection, **Then** the game continues without them (their
   turn is skipped) and they may still rejoin later as a spectator... unless
   the room is configured to remove/bot-skip them permanently.

---

### User Story 4 - House rules and the 112-card variant (Priority: P3)

Before starting a game, the host can toggle optional rules: the 4 extra
Wild cards (Swap Hands / Shuffle Hands / blank Customizable), stacking
Draw Two/Draw Four, and 2-player Reverse-acts-as-Skip.

**Why this priority**: Nice-to-have variety once the core loop works;
explicitly out of scope for MVP per the constitution's simplicity
principle.

**Independent Test**: Toggle "include Swap/Shuffle Hands cards" on in room
settings, start a game, and confirm the deck size and card pool reflect the
112-card variant; toggle it off and confirm the classic 108-card deck.

**Acceptance Scenarios**:

1. **Given** the host is in the lobby, **When** they enable the 112-card
   variant, **Then** the deck used for that game includes one Wild
   Swap Hands OR one Wild Shuffle Hands card (host's choice) plus up to 3
   blank Wild Customizable cards with host-entered text.
2. **Given** a 2-player room, **When** house rules for 2-player mode are
   on, **Then** Reverse acts as Skip and Draw Two/Draw Four return play to
   the drawer's opponent immediately after the forced draw.

---

### Edge Cases

- What happens when the room code is invalid or the room already started
  its game? → Reject join with a clear error; allow spectating only if the
  host enabled spectators (not in MVP).
- What happens when a player tries to play a card that doesn't match and
  isn't Wild? → Server rejects the move; client shows an inline error, hand
  unchanged.
- What happens when a player plays Wild Draw Four while holding a card that
  matches the current color (illegal play)? → Move is accepted face-up
  only if immediately challenged; server tracks whether the player had a
  legal alternative and resolves the challenge per the rules (loser draws
  the cards).
- What happens if the host disconnects? → Host role transfers to the next
  connected player; the room does not die.
- What happens when everyone but one player disconnects? → Game pauses;
  no forced draws accumulate against fully-disconnected players once only
  one active player remains.
- What happens on a tie for "first to reach the score target" across
  rounds? → Play continues until a single player is strictly above the
  target at the end of a round.
- What happens if two players click "join" with the same display name in
  one room? → Server appends a disambiguating suffix (e.g., "Sam (2)").
- What happens if someone submits an obviously malformed email at first
  login? → Client and server both reject it with an inline error; no
  `User` record is created until a syntactically valid email is given.
- What happens if two different people happen to type the same email? →
  The system has no password or verification step (see Assumptions), so it
  treats them as the same identity by design; this is an accepted
  limitation for a private friend-group app, not a bug to fix in MVP.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a user create a room without registering an
  account, using only a display name.
- **FR-002**: System MUST generate a short, shareable, unique room code and
  a shareable join link for each room.
- **FR-003**: System MUST support 2-10 players per room, matching classic
  Uno's player range.
- **FR-004**: System MUST deal 7 cards to each player at game start and
  flip one card to seed the discard pile, applying the "first card is an
  Action/Wild/Wild-Draw-Four" rules exactly as specified in the rules
  document.
- **FR-005**: System MUST enforce play legality server-side: a played card
  must match the discard pile top by color, number, or symbol, or be a
  Wild/Wild Draw Four.
- **FR-006**: System MUST implement all Action card effects: Skip, Reverse
  (including 2-player acts-as-Skip when that house rule is on), Draw Two,
  Wild (color choice), Wild Draw Four (color choice + legality challenge
  mechanic with correct draw penalties for winner/loser of a challenge).
- **FR-007**: System MUST let a player draw a card on their turn when they
  cannot or choose not to play, immediately allow playing that drawn card
  if legal, and otherwise pass the turn.
- **FR-008**: System MUST reshuffle the discard pile (except its top card)
  into a new draw pile whenever the draw pile is exhausted mid-game.
- **FR-009**: System MUST require a player who reaches exactly one card to
  declare "UNO!" and MUST allow any other player to catch a missed
  declaration before the next player's turn starts, applying a two-card
  draw penalty to the offender.
- **FR-010**: System MUST end the round immediately when a player's hand
  reaches zero cards, and MUST compute round score as the sum of card
  values remaining in every other player's hand (number cards = face
  value; Skip/Reverse/Draw Two = 20; Wild/Wild Draw Four = 50;
  Swap/Customizable = 40 when the 112-card variant is enabled).
- **FR-011**: System MUST broadcast game state changes to all players in a
  room in real time, sending each player only their own hand's card
  values and everyone else's card counts.
- **FR-012**: System MUST persist all room/game state directly in MongoDB
  (the only copy — see Constitution Principle I) so an in-progress game
  survives a server process restart with nothing to rehydrate.
- **FR-013**: System MUST let a disconnected player rejoin the same room
  and seat within a configurable grace period (default 3 minutes) and
  resume with their existing hand and turn state intact.
- **FR-014**: System MUST transfer the host role to another connected
  player if the current host disconnects, without ending the room.
- **FR-015**: System MUST let the host configure, before game start,
  whether the 112-card variant (extra Wild cards) and 2-player house rules
  are active for that game.
- **FR-016**: System MUST track a running score across rounds within a
  room and display a running total; the host sets the target score to end
  the match (default 500, per the rules) at room creation.
- **FR-017**: System MUST validate that a player only ever acts on their
  own turn; out-of-turn actions are rejected server-side regardless of
  what the client sends.
- **FR-018**: System MUST present the game screen in a landscape-optimized
  layout as the primary design target for mobile phones, and MUST prompt
  the player to rotate their device when a small-screen viewport is in
  portrait orientation, without hard-locking orientation.
- **FR-019**: System MUST prompt a browser/device with no stored identity
  for a display name and an email address before allowing room creation or
  joining ("first login"), and MUST NOT show this prompt again once an
  identity has been established for that browser.
- **FR-020**: System MUST create a `User` record in MongoDB on first-login
  submission, matching an existing record by email instead of creating a
  duplicate when that email has been seen before.
- **FR-021**: System MUST persist per-player match statistics (games
  played, games won, total score) as fields on that player's `User`
  document in MongoDB, updated at round/match end, with MongoDB as the
  sole authoritative copy (no client-side stats store).
- **FR-022**: System MUST NOT require a password or email verification for
  first-login identity capture; email is used only as a stable identity
  key (see Assumptions for the accepted tradeoff).

### Key Entities

- **User**: A persistent player identity captured at first login — display
  name, email (unique key used to recognize returning players), created
  timestamp, and cumulative stats (games played, games won, total score).
  Distinct from `Player` below: a `User` persists across every room and
  session; a `Player` is that same person's seat within one room.
- **Room**: A game lobby/table identified by a short code. Has a host, a
  list of players/seats, a status (lobby / in-progress / round-ended /
  match-ended), house-rule settings, and a target score.
- **Player**: A participant in a room — references the seated person's
  `User` id, display name for this room, socket/session binding,
  seat/turn order position, connection status (connected / reconnecting /
  disconnected), running match score for this room.
- **Game**: One active round's state within a room — the deck, draw pile,
  discard pile, each player's hand (server-only, never sent in full to
  other clients), current turn index, direction, current active color, and
  pending-challenge state for Wild Draw Four.
- **Card**: Color (red/yellow/green/blue/wild), type (number 0-9,
  skip/reverse/draw-two/wild/wild-draw-four, plus optional
  swap-hands/shuffle-hands/customizable), and for customizable cards, the
  host-entered house-rule text.
- **RoundResult**: Per-round record — winner, per-player remaining hand
  score, timestamp — persisted for the room's match history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A group of friends can go from "here's the link" to "playing
  their first card" in under 60 seconds, including one-time first-login
  identity capture.
- **SC-002**: A played card is reflected on every other connected player's
  screen within 500ms under normal home-internet conditions.
- **SC-003**: A player who reconnects within the grace period resumes with
  100% of their hand and turn state correct, verified across at least 20
  manual/automated reconnect tests during development.
- **SC-004**: The full app (frontend + backend + database) runs at $0/month
  on the chosen free-tier hosting, for typical friend-group usage (a
  handful of concurrent rooms, not sustained high traffic).
- **SC-005**: The game-rules engine (deck, legality, scoring, turn
  resolution) has automated test coverage for every Action card and the
  Wild Draw Four challenge, with 0 known rule-violating states reachable
  through normal client actions.
- **SC-006**: A returning player on the same browser never sees the
  first-login prompt twice, and their MongoDB-tracked stats correctly
  accumulate across at least 2 separate play sessions in manual testing.

## Assumptions

- Target audience is small private friend groups (2-10 players per room),
  not public matchmaking or anti-cheat-hardened competitive play; the
  server-authoritative model in the constitution is sufficient defense
  against casual cheating.
- Players access the game from modern desktop or mobile browsers; no
  native mobile app is in scope.
- Most players will be on a phone held in landscape orientation; the UI is
  designed landscape-first for mobile, with portrait and desktop as
  secondary supported layouts (see FR-018).
- "Free to deploy" means the app runs entirely on free tiers (Render/
  Vercel/Netlify + MongoDB Atlas free cluster); it does not need to survive
  large-scale traffic, and a free-tier backend that cold-starts after
  inactivity is an acceptable tradeoff, mitigated by FR-012/FR-013.
- First-login identity capture (FR-019/020) is a lightweight profile, not
  authentication: no password, no email-ownership verification, no
  session tokens beyond the identity stored in the browser. Anyone who
  types a friend's email is treated as that friend. This is an accepted
  tradeoff for a private friend-group app, not a security boundary; a real
  auth system is out of scope unless a later spec calls for it.
- The 112-card variant and other house rules (P3) can ship after the core
  classic-rules loop and identity capture (both P1) and reconnection (P2)
  are solid.
