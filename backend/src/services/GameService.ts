import type { Card, Color } from '@uno/shared';
import { GameModel } from '../models/Game';
import { RoomModel } from '../models/Room';
import { RoundResultModel } from '../models/RoundResult';
import {
  callUno as engineCallUno,
  catchUno as engineCatchUno,
  challengeWildDrawFour as engineChallenge,
  chooseStartColor as engineChooseStartColor,
  declineChallenge as engineDeclineChallenge,
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
  // Mongoose subdocuments expose their fields (id/color/type) via prototype
  // getters, not own enumerable properties, so `{ ...card }` silently drops
  // them. `toObject()` first converts the whole document — including nested
  // Card subdocuments and the `hands` Map — into plain JSON-safe objects.
  const obj = doc.toObject({ flattenMaps: true });

  return {
    roomCode: obj.roomCode,
    version: obj.version,
    roundNumber: obj.roundNumber,
    deck: obj.deck,
    discardPile: obj.discardPile,
    hands: obj.hands ?? {},
    activeColor: obj.activeColor as Color,
    turnOrder: [...obj.turnOrder],
    turnIndex: obj.turnIndex,
    direction: obj.direction as 1 | -1,
    pendingUnoCall: obj.pendingUnoCall ?? null,
    pendingChallenge: obj.pendingChallenge ?? null,
    pendingDrawDecision: obj.pendingDrawDecision ?? null,
    updatedAt: obj.updatedAt ?? new Date(),
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

  /** Team Mode requires 4 players (2 per team) or 5 players (3-2 split),
   * reseated so turn order alternates between teams as evenly as possible —
   * rules.ts's turn-order math is entirely unaware of teams and needs no
   * changes for this to work. With an uneven 3-2 split at 5 players, the
   * larger team's third seat necessarily falls next to its own teammate once
   * per lap (seat 4 -> seat 0) — an unavoidable consequence of an odd team. */
  private arrangeTeamSeats(room: InstanceType<typeof RoomModel>): void {
    const count = room.players.length;
    if (count !== 4 && count !== 5) {
      throw new IllegalActionError('invalid_teams', 'Team mode needs 4 or 5 players.');
    }
    const teamA = room.players.filter((p) => p.teamId === 0);
    const teamB = room.players.filter((p) => p.teamId === 1);
    if (teamA.length + teamB.length !== count) {
      throw new IllegalActionError('invalid_teams', 'Every player must pick a team.');
    }
    const sizes = [teamA.length, teamB.length].sort((a, b) => a - b);
    const validSizes = count === 4 ? [2, 2] : [2, 3];
    if (sizes[0] !== validSizes[0] || sizes[1] !== validSizes[1]) {
      throw new IllegalActionError(
        'invalid_teams',
        count === 4 ? 'Team mode needs exactly 2 players per team.' : 'Team mode needs a 3-2 team split with 5 players.',
      );
    }
    const seated: (typeof room.players)[number][] = [];
    const maxLen = Math.max(teamA.length, teamB.length);
    for (let i = 0; i < maxLen; i++) {
      if (teamA[i]) seated.push(teamA[i]);
      if (teamB[i]) seated.push(teamB[i]);
    }
    seated.forEach((p, i) => {
      p.seat = i;
    });
  }

  async startGame(roomCode: string, callerId: string) {
    const preCheck = await RoomModel.findOne({ code: roomCode });
    if (!preCheck) throw new IllegalActionError('room_not_found', 'No room with that code exists.');
    const caller = preCheck.players.find((p) => p.id === callerId);
    if (!caller?.isHost) {
      throw new IllegalActionError('not_host', 'Only the host can start the game.');
    }

    // Atomically claim the lobby -> in_progress transition before reading
    // room.players for dealing, so a join landing between the check above and
    // dealing can't be persisted into Room.players while silently excluded
    // from the Game's turnOrder/hands — joinRoom rejects once status isn't
    // 'lobby' anymore, closing the race instead of dealing a stale snapshot.
    const room = await RoomModel.findOneAndUpdate(
      { code: roomCode, status: 'lobby' },
      { $set: { status: 'in_progress' } },
      { new: true },
    );
    if (!room) {
      throw new IllegalActionError('already_started', 'This room has already started.');
    }

    try {
      if (room.settings.teamMode) {
        this.arrangeTeamSeats(room);
      } else if (room.players.length < 2 || room.players.length > 10) {
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

      await room.save(); // persists any seat reassignment from arrangeTeamSeats

      return { room, game: gameDoc, events };
    } catch (err) {
      await RoomModel.updateOne({ code: roomCode }, { $set: { status: 'lobby' } });
      throw err;
    }
  }

  async nextRound(roomCode: string, callerId: string) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) throw new IllegalActionError('room_not_found', 'No room with that code exists.');
    const caller = room.players.find((p) => p.id === callerId);
    if (!caller?.isHost) {
      throw new IllegalActionError('not_host', 'Only the host can start the next round.');
    }
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
    const teamOf: Record<string, 0 | 1> | undefined = room?.settings.teamMode
      ? Object.fromEntries(
          room.players.filter((p) => p.teamId === 0 || p.teamId === 1).map((p) => [p.id, p.teamId as 0 | 1]),
        )
      : undefined;
    const houseRules = {
      twoPlayerReverseIsSkip: Boolean(room?.settings.twoPlayerHouseRules) && room?.players.length === 2,
      teamOf,
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

  async catchUno(roomCode: string, callerId: string, targetPlayerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => {
      if (!state.turnOrder.includes(callerId)) {
        throw new IllegalActionError('not_in_game', 'You are not seated in this game.');
      }
      return engineCatchUno(state, targetPlayerId);
    });
  }

  async challengeWildDrawFour(roomCode: string, challengerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => engineChallenge(state, challengerId));
  }

  async declineChallenge(roomCode: string, playerId: string): Promise<ActionOutcome> {
    return this.runAction(roomCode, (state) => {
      engineDeclineChallenge(state, playerId);
      return [];
    });
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
      try {
        const outcome = await this.finalizeRound(roomCode, state, roundEndedEvent.winnerId);
        matchEnded = outcome.matchEnded;
        roundResult = outcome.roundResult;
      } catch (err) {
        // The Game document above is already persisted with the round over.
        // Don't let a scoring/stats failure here throw away that broadcast —
        // the caller still sends `game` to every player below; only the
        // round-result/score summary is missing in this (rare) failure case.
        // eslint-disable-next-line no-console
        console.error('finalizeRound failed after a round-ending play', err);
      }
    }

    return { game, events, roundEnded: Boolean(roundEndedEvent), matchEnded, roundResult };
  }

  private async finalizeRound(roomCode: string, state: GameState, winnerId: string) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) return { matchEnded: false, roundResult: null };

    const teamOf: Record<string, 0 | 1> | undefined = room.settings.teamMode
      ? Object.fromEntries(
          room.players.filter((p) => p.teamId === 0 || p.teamId === 1).map((p) => [p.id, p.teamId as 0 | 1]),
        )
      : undefined;
    const scoreResult = computeRoundScore(state.hands, winnerId, teamOf);
    const winningTeamId = teamOf?.[winnerId];
    const scores = room.players.map((p) => ({
      playerId: p.id,
      displayName: p.displayName,
      cardsLeftValue: scoreResult.perPlayerCardsLeftValue[p.id] ?? 0,
      teamId: teamOf ? p.teamId ?? undefined : undefined,
    }));

    const roundResult = await RoundResultModel.create({
      roomCode,
      roundNumber: state.roundNumber,
      winnerId,
      winningTeamId: winningTeamId ?? null,
      scores,
      endedAt: new Date(),
    });

    // In Team Mode, both teammates receive the round's points, not only
    // whichever of them happened to empty their hand.
    const roundWinners =
      winningTeamId !== undefined
        ? room.players.filter((p) => p.teamId === winningTeamId)
        : room.players.filter((p) => p.id === winnerId);
    for (const w of roundWinners) {
      w.matchScore += scoreResult.pointsAwardedToWinner;
      await userService.addRoundScore(w.userId, scoreResult.pointsAwardedToWinner);
    }

    const matchEnded = room.players.some((p) => p.matchScore >= room.settings.targetScore);
    room.status = matchEnded ? 'match_ended' : 'round_ended';
    await room.save();

    if (matchEnded) {
      const matchWinner = [...room.players].sort((a, b) => b.matchScore - a.matchScore)[0];
      const matchWinners =
        matchWinner.teamId === 0 || matchWinner.teamId === 1
          ? room.players.filter((p) => p.teamId === matchWinner.teamId)
          : [matchWinner];
      await userService.recordMatchCompletion(
        room.players.map((p) => p.userId),
        matchWinners.map((p) => p.userId),
      );
    }

    return { matchEnded, roundResult };
  }
}

export const gameService = new GameService();
