// Shared wire types for REST + Socket.IO payloads (contracts/socket-events.md, contracts/rest-api.md).
// Imported by both backend and frontend so client/server payloads can never drift (Constitution Principle I).

export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export type CardType =
  | { kind: 'number'; value: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
  | { kind: 'skip' }
  | { kind: 'reverse' }
  | { kind: 'draw_two' }
  | { kind: 'wild' }
  | { kind: 'wild_draw_four' }
  | { kind: 'wild_swap_hands' }
  | { kind: 'wild_shuffle_hands' }
  | { kind: 'wild_customizable'; text: string };

export interface Card {
  id: string;
  color: Color;
  type: CardType;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
export type RoomStatus = 'lobby' | 'in_progress' | 'round_ended' | 'match_ended';
export type Variant112 = 'off' | 'swap' | 'shuffle';

export interface RoomSettings {
  targetScore: number;
  variant112: Variant112;
  customizableCount: number; // 0-3
  customizableTexts: string[];
  twoPlayerHouseRules: boolean;
  reconnectGraceSeconds: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  targetScore: 500,
  variant112: 'off',
  customizableCount: 0,
  customizableTexts: [],
  twoPlayerHouseRules: false,
  reconnectGraceSeconds: 180,
};

export interface PlayerView {
  id: string;
  userId: string;
  displayName: string;
  connectionStatus: ConnectionStatus;
  seat: number;
  isHost: boolean;
  matchScore: number;
  handCount: number;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  players: PlayerView[];
  settings: RoomSettings;
  createdAt: string;
}

export interface PendingUnoCall {
  playerId: string;
}

export interface PendingChallenge {
  playerId: string;
  hadLegalAlternative: boolean;
  targetPlayerId: string;
}

export interface PendingDrawDecision {
  playerId: string;
  cardId: string;
}

/** Game state as seen by one specific recipient: their own hand, everyone else as a count. */
export interface GameView {
  roomCode: string;
  version: number;
  hand: Card[];
  handCounts: Record<string, number>;
  discardTop: Card | null;
  activeColor: Color;
  turnIndex: number;
  turnPlayerId: string;
  direction: 1 | -1;
  pendingUnoCall: PendingUnoCall | null;
  pendingChallenge: PendingChallenge | null;
  pendingDrawDecision: PendingDrawDecision | null;
  drawPileCount: number;
  status: RoomStatus;
}

export interface RoundResultView {
  roomCode: string;
  roundNumber: number;
  winnerId: string;
  scores: { playerId: string; displayName: string; cardsLeftValue: number }[];
  endedAt: string;
}

export interface MatchEndedPayload {
  winnerId: string;
  finalScores: { playerId: string; displayName: string; total: number }[];
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  stats: { gamesPlayed: number; gamesWon: number; totalScore: number };
}

// ---- REST payloads (contracts/rest-api.md) ----

export interface CreateUserRequest {
  name: string;
  email: string;
}
export type CreateUserResponse = UserProfile;

export interface UserStatsResponse {
  name: string;
  stats: UserProfile['stats'];
}

export interface CreateRoomRequest {
  userId: string;
  hostDisplayName: string;
  settings?: Partial<RoomSettings>;
}
export interface CreateRoomResponse {
  roomCode: string;
  playerId: string;
  joinUrl: string;
}

export interface JoinPreflightResponse {
  status: 'lobby' | 'in_progress' | 'full' | 'not_found';
}

export interface RoomResultsResponse {
  rounds: RoundResultView[];
  matchScores: { playerId: string; displayName: string; total: number }[];
}

export interface HealthResponse {
  status: 'ok';
}

// ---- Socket.IO client -> server intents (contracts/socket-events.md) ----

export interface RoomJoinIntent {
  roomCode: string;
  userId: string;
  playerId?: string;
  displayName: string;
}
export interface RoomStartIntent {
  roomCode: string;
}
export interface PlayCardIntent {
  roomCode: string;
  cardId: string;
  chosenColor?: Color;
}
export interface DrawCardIntent {
  roomCode: string;
}
export interface PassTurnIntent {
  roomCode: string;
}
export interface ChooseStartColorIntent {
  roomCode: string;
  color: Exclude<Color, 'wild'>;
}
export interface CallUnoIntent {
  roomCode: string;
}
export interface CatchUnoIntent {
  roomCode: string;
  targetPlayerId: string;
}
export interface ChallengeWildDrawFourIntent {
  roomCode: string;
}
export interface NextRoundIntent {
  roomCode: string;
}

// ---- Socket.IO server -> client events ----

export interface PlayerPresenceEvent {
  playerId: string;
  connectionStatus: ConnectionStatus;
}
export interface GameErrorEvent {
  code: string;
  message: string;
}

export const SOCKET_EVENTS = {
  ROOM_JOIN: 'room:join',
  ROOM_START: 'room:start',
  ROOM_NEXT_ROUND: 'room:next_round',
  ROOM_STATE: 'room:state',
  GAME_PLAY_CARD: 'game:play_card',
  GAME_DRAW_CARD: 'game:draw_card',
  GAME_PASS_TURN: 'game:pass_turn',
  GAME_CHOOSE_START_COLOR: 'game:choose_start_color',
  GAME_CALL_UNO: 'game:call_uno',
  GAME_CATCH_UNO: 'game:catch_uno',
  GAME_CHALLENGE_WILD_DRAW_FOUR: 'game:challenge_wild_draw_four',
  GAME_STATE: 'game:state',
  GAME_ROUND_ENDED: 'game:round_ended',
  GAME_MATCH_ENDED: 'game:match_ended',
  PLAYER_PRESENCE: 'player:presence',
  GAME_ERROR: 'game:error',
} as const;
