import type { Card, Color } from '@uno/shared';
import { GameModel } from '../models/Game';
import { RoomModel } from '../models/Room';
import { RoundResultModel } from '../models/RoundResult';
import {
  callUno as engineCallUno,
  catchUno as engineCatchUno,
  challengeWildDrawFour as engineChallenge,
  chooseStartColor as engineChooseStartColor,
  drawCard as engineDrawCard,
  passTurn as enginePassTurn,
  playCard as enginePlayCard,
  setupGame,
  type PlayCardInput,
} from '../game/rules';
import { computeRoundScore } from '../game/scoring';
import type { DeckOptions, EngineEvent, GameState } from '../game/types';
import { IllegalActionError } from '../game/types';
import { userService } from './UserService';

function toGameState(doc: any): GameState {
  const handsSource = doc.hands instanceof Map ? Object.fromEntries(doc.hands) : doc.hands || {};
  const hands: Record<string, Card[]> = {};
  for (const [k, v] of Object.entries(handsSource)) hands[k] = (v as Card[]).map((c) => ({ ...c }));

  return {
    roomCode: doc.roomCode,
    version: doc.version,
    roundNumber: doc.roundNumber,
    deck: doc.deck.map((c: Card) => ({ ...c })),
    discardPile: doc.discardPile.map((c: Card) => ({ ...c })),
    hands,
    activeColor: doc.activeColor as Color,
    turnOrder: [...doc.turnOrder],
    turnIndex: doc.turnIndex,
    direction: doc.direction as 1 | -1,
    pendingUnoCall: doc.pendingUnoCall ? { ...doc.pendingUnoCall } : null,
    pendingChallenge: doc.pendingChallenge ? { ...doc.pendingChallenge } : null,
    pendingDrawDecision: doc.pendingDrawDecision ? { ...doc.pendingDrawDecision } : null,
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

async function persist(roomCode: string, expectedVersion: number, state: GameState) {
  const updated = await GameModel.findOneAndUpdate(
    { roomCode, version: expectedVersion },
    {
      $set: {
        version: state.version,
        roundNumber: state.roundNumber,
        deck: state.deck,
        discardPile: state.discardPile,
        hands: state.hands,
        activeColor: state.activeColor,
        turnOrder: state.turnOrder,
        turnIndex: state.turnIndex,
        direction: state.direction,
        pendingUnoCall: state.pendingUnoCall,
        pendingChallenge: state.pendingChallenge,
        pendingDrawDecision: state.pendingDrawDecision,
      },
    },
    { new: true },
  );
  if (!updated) {
    throw new IllegalActionError('conflict', 'Game state changed — please retry your action.');
  }
  return updated;
}

export interface ActionOutcome {
  game: Awaited<ReturnType<typeof persist>>;
  events: EngineEvent[];
  roundEnded: boolean;
  matchEnded: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roundResult: any;
}

export class GameService {
  private async loadState(roomCode: string): Promise<{ state: GameState; expectedVersion: number }> {
    const doc = await GameModel.findOne({ roomCode });
    if (!doc) throw new IllegalActionError('game_not_found', 'No active game for this room.');
    return { state: toGameState(doc), expectedVersion: doc.version };
  }

  async startGame(roomCode: string) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) throw new IllegalActionError('room_not_found', 'No room with that code exists.');
    if (room.status !== 'lobby') {
      throw new IllegalActionError('already_started', 'This room has already started.');
    }
    if (room.players.length < 2 || room.players.length > 10) {
      throw new IllegalActionError('invalid_player_count', 'Uno needs 2 to 10 players.');
    }

    const deckOptions: DeckOptions = {
      includeSwapOrShuffle: room.settings.variant112 === 'off' ? undefined : room.settings.variant112,
      customizableCount: room.settings.customizableCount as 0 | 1 | 2 | 3,
      customizableTexts: room.settings.customizableTexts,
    };

    const { game, events } = setupGame(roomCode, room.players as any, deckOptions);
    await GameModel.findOneAndDelete({ roomCode }); // clear any stale doc from a previous round/room reuse
    const gameDoc = await GameModel.create(game);

    room.status = 'in_progress';
    await room.save();

    return { room, game: gameDoc, events };
  }

  async nextRound(roomCode: string) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) throw new IllegalActionError('room_not_found', 'No room with that code exists.');
    if (room.status !== 'round_ended') {
      throw new IllegalActionError('not_round_ended', 'The current round has not ended yet.');
    }

    const previous = await GameModel.findOne({ roomCode });
    const roundNumber = (previous?.roundNumber ?? 0) + 1;

    const deckOptions: DeckOptions = {
      includeSwapOrShuffle: room.settings.variant112 === 'off' ? undefined : room.settings.variant112,
      customizableCount: room.settings.customizableCount as 0 | 1 | 2 | 3,
      customizableTexts: room.settings.customizableTexts,
    };
    const { game, events } = setupGame(roomCode, room.players as any, deckOptions);
    game.roundNumber = roundNumber;

    await GameModel.findOneAndDelete({ roomCode });
    const gameDoc = await GameModel.create(game);

    room.status = 'in_progress';
    await room.save();

    return { room, game: gameDoc, events };
  }

  async chooseStartColor(roomCode: string, playerId: string, color: Exclude<Color, 'wild'>) {
    const { state, expectedVersion } = await this.loadState(roomCode);
    engineChooseStartColor(state, playerId, color);
    state.version += 1;
    const game = await persist(roomCode, expectedVersion, state);
    return { game, events: [] as EngineEvent[], roundEnded: false, matchEnded: false };
  }

  async playCard(roomCode: string, input: PlayCardInput): Promise<ActionOutcome> {
    const room = await RoomModel.findOne({ code: roomCode });
    const houseRules = {
      twoPlayerReverseIsSkip: Boolean(room?.settings.twoPlayerHouseRules) && room?.players.length === 2,
    };
    return this.runAction(roomCode, (state) => enginePlayCard(state, input, houseRules));
  }

  async drawCard(roomCode: string, playerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => engineDrawCard(state, playerId).events);
  }

  async passTurn(roomCode: string, playerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => {
      enginePassTurn(state, playerId);
      return [];
    });
  }

  /** Grace-period expiry for a disconnected player (FR-013): draw if it's
   * their turn and they haven't already, then pass — the least game-altering
   * default since they're not present to choose. No-ops if it's not their
   * turn by the time the timer fires. */
  async autoSkipTurn(roomCode: string, playerId: string): Promise<ActionOutcome | null> {
    try {
      if (!(await this.isPlayersTurn(roomCode, playerId))) return null;
      if (!(await this.hasPendingDrawDecision(roomCode, playerId))) {
        await this.drawCard(roomCode, playerId);
      }
      if (await this.hasPendingDrawDecision(roomCode, playerId)) {
        return await this.passTurn(roomCode, playerId);
      }
      return null;
    } catch {
      return null; // turn moved on / round ended between the check and the action — fine to skip
    }
  }

  private async isPlayersTurn(roomCode: string, playerId: string): Promise<boolean> {
    const doc = await GameModel.findOne({ roomCode });
    return !!doc && doc.turnOrder[doc.turnIndex] === playerId;
  }

  private async hasPendingDrawDecision(roomCode: string, playerId: string): Promise<boolean> {
    const doc = await GameModel.findOne({ roomCode });
    return doc?.pendingDrawDecision?.playerId === playerId;
  }

  async callUno(roomCode: string, playerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => {
      engineCallUno(state, playerId);
      return [];
    });
  }

  async catchUno(roomCode: string, targetPlayerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => engineCatchUno(state, targetPlayerId));
  }

  async challengeWildDrawFour(roomCode: string, challengerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => engineChallenge(state, challengerId));
  }

  private async runAction(
    roomCode: string,
    mutate: (state: GameState) => EngineEvent[],
  ): Promise<ActionOutcome> {
    const { state, expectedVersion } = await this.loadState(roomCode);
    const events = mutate(state);
    const game = await persist(roomCode, expectedVersion, state);

    const roundEndedEvent = events.find((e) => e.type === 'round_ended');
    let matchEnded = false;
    let roundResult: ActionOutcome['roundResult'] = null;
    if (roundEndedEvent && roundEndedEvent.type === 'round_ended') {
      const outcome = await this.finalizeRound(roomCode, state, roundEndedEvent.winnerId);
      matchEnded = outcome.matchEnded;
      roundResult = outcome.roundResult;
    }

    return { game, events, roundEnded: Boolean(roundEndedEvent), matchEnded, roundResult };
  }

  private async finalizeRound(roomCode: string, state: GameState, winnerId: string) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) return { matchEnded: false, roundResult: null };

    const scoreResult = computeRoundScore(state.hands, winnerId);
    const scores = room.players.map((p) => ({
      playerId: p.id,
      displayName: p.displayName,
      cardsLeftValue: scoreResult.perPlayerCardsLeftValue[p.id] ?? 0,
    }));

    const roundResult = await RoundResultModel.create({
      roomCode,
      roundNumber: state.roundNumber,
      winnerId,
      scores,
      endedAt: new Date(),
    });

    const winner = room.players.find((p) => p.id === winnerId);
    if (winner) {
      winner.matchScore += scoreResult.pointsAwardedToWinner;
      await userService.addRoundScore(winner.userId, scoreResult.pointsAwardedToWinner);
    }

    const matchEnded = room.players.some((p) => p.matchScore >= room.settings.targetScore);
    room.status = matchEnded ? 'match_ended' : 'round_ended';
    await room.save();

    if (matchEnded) {
      const matchWinner = [...room.players].sort((a, b) => b.matchScore - a.matchScore)[0];
      await userService.recordMatchCompletion(
        room.players.map((p) => p.userId),
        matchWinner.userId,
      );
    }

    return { matchEnded, roundResult };
  }
}

export const gameService = new GameService();
