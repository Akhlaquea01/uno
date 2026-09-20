import type { Card, Color, ConnectionStatus, RoomSettings, RoomStatus } from '@uno/shared';

/** A seat in a Room — identity/connection/score, persists across rounds. */
export interface PlayerState {
  id: string; // room-scoped player id, stable across reconnects
  userId: string;
  displayName: string;
  socketId: string | null;
  connectionStatus: ConnectionStatus;
  seat: number;
  isHost: boolean;
  matchScore: number;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  players: PlayerState[];
  settings: RoomSettings;
  createdAt: Date;
}

export interface PendingUnoCallState {
  playerId: string;
}

export interface PendingChallengeState {
  playerId: string; // who played the Wild Draw Four
  hadLegalAlternative: boolean;
  targetPlayerId: string; // who would draw 4 / may challenge
  drawnCardIds: string[]; // the optimistically-drawn cards, undone if the challenge succeeds
}

export interface PendingDrawDecisionState {
  playerId: string;
  cardId: string;
}

/** One active round's state — reset every round; hands live here, keyed by room-scoped player id. */
export interface GameState {
  roomCode: string;
  version: number;
  roundNumber: number;
  deck: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
  activeColor: Color;
  turnOrder: string[]; // player ids, seat order at round start
  turnIndex: number;
  direction: 1 | -1;
  pendingUnoCall: PendingUnoCallState | null;
  pendingChallenge: PendingChallengeState | null;
  /** Set right after a draw whose card is playable; cleared by playing that card or passing. */
  pendingDrawDecision: PendingDrawDecisionState | null;
  updatedAt: Date;
}

export interface DeckOptions {
  includeSwapOrShuffle?: 'swap' | 'shuffle';
  customizableCount?: 0 | 1 | 2 | 3;
  customizableTexts?: string[];
}

/** Outcome of applying one player action to a GameState. */
export interface ActionResult {
  game: GameState;
  roomPatch?: Partial<Pick<RoomState, 'status'>>;
  events: EngineEvent[];
}

export type EngineEvent =
  | { type: 'round_ended'; winnerId: string }
  | { type: 'penalty_draw'; playerId: string; count: number; reason: 'uno_missed' | 'challenge_lost' | 'draw_two' | 'wild_draw_four' }
  | { type: 'challenge_opened'; byPlayerId: string };

export class IllegalActionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'IllegalActionError';
  }
}
