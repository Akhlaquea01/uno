import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  type CallUnoIntent,
  type CatchUnoIntent,
  type ChallengeWildDrawFourIntent,
  type ChooseStartColorIntent,
  type DeclineChallengeIntent,
  type DrawCardIntent,
  type MatchEndedPayload,
  type PassTurnIntent,
  type PlayCardIntent,
  type RoundResultView,
  type TeamId,
} from '@uno/shared';
import { RoomModel } from '../models/Room';
import { gameService, type ActionOutcome } from '../services/GameService';
import {
  broadcastGameState,
  broadcastRoomState,
  emitError,
  maybeScheduleAutoSkip,
  maybeScheduleChallengeAutoDecline,
} from './views';

function toRoundResultView(doc: any): RoundResultView {
  return {
    roomCode: doc.roomCode,
    roundNumber: doc.roundNumber,
    winnerId: doc.winnerId,
    winningTeamId: (doc.winningTeamId ?? undefined) as TeamId | undefined,
    scores: doc.scores.map((s: any) => ({
      playerId: s.playerId,
      displayName: s.displayName,
      cardsLeftValue: s.cardsLeftValue,
      teamId: (s.teamId ?? undefined) as TeamId | undefined,
    })),
    endedAt: (doc.endedAt ?? new Date()).toISOString(),
  };
}

async function broadcastOutcome(io: Server, roomCode: string, outcome: ActionOutcome): Promise<void> {
  const room = await RoomModel.findOne({ code: roomCode });
  if (!room) return;

  broadcastGameState(io, room, outcome.game);
  if (!outcome.roundEnded) {
    maybeScheduleAutoSkip(io, room, outcome.game);
    maybeScheduleChallengeAutoDecline(io, room, outcome.game);
  }

  if (outcome.roundEnded && outcome.roundResult) {
    io.to(roomCode).emit(SOCKET_EVENTS.GAME_ROUND_ENDED, toRoundResultView(outcome.roundResult));
    broadcastRoomState(io, room);
  }

  if (outcome.matchEnded) {
    const winner = [...room.players].sort((a, b) => b.matchScore - a.matchScore)[0];
    const winningTeamId = (
      winner?.teamId === 0 || winner?.teamId === 1 ? winner.teamId : undefined
    ) as TeamId | undefined;
    const payload: MatchEndedPayload = {
      winnerId: winner?.id ?? '',
      winningTeamId,
      finalScores: room.players.map((p) => ({
        playerId: p.id,
        displayName: p.displayName,
        total: p.matchScore,
        teamId: (p.teamId ?? undefined) as TeamId | undefined,
      })),
    };
    io.to(roomCode).emit(SOCKET_EVENTS.GAME_MATCH_ENDED, payload);
  }
}

export function registerGameHandlers(io: Server, socket: Socket): void {
  const playerId = () => (socket.data as { playerId?: string }).playerId;

  socket.on(SOCKET_EVENTS.GAME_CHOOSE_START_COLOR, async (payload: ChooseStartColorIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const { game } = await gameService.chooseStartColor(payload.roomCode, pid, payload.color);
      const room = await RoomModel.findOne({ code: payload.roomCode });
      if (room) broadcastGameState(io, room, game);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_PLAY_CARD, async (payload: PlayCardIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.playCard(payload.roomCode, {
        playerId: pid,
        cardId: payload.cardId,
        chosenColor: payload.chosenColor,
        targetPlayerId: payload.targetPlayerId,
      });
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_DRAW_CARD, async (payload: DrawCardIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.drawCard(payload.roomCode, pid);
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_PASS_TURN, async (payload: PassTurnIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.passTurn(payload.roomCode, pid);
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_CALL_UNO, async (payload: CallUnoIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.callUno(payload.roomCode, pid);
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_CATCH_UNO, async (payload: CatchUnoIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.catchUno(payload.roomCode, pid, payload.targetPlayerId);
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_CHALLENGE_WILD_DRAW_FOUR, async (payload: ChallengeWildDrawFourIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.challengeWildDrawFour(payload.roomCode, pid);
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.GAME_DECLINE_CHALLENGE, async (payload: DeclineChallengeIntent) => {
    try {
      const pid = playerId();
      if (!pid) return;
      const outcome = await gameService.declineChallenge(payload.roomCode, pid);
      await broadcastOutcome(io, payload.roomCode, outcome);
    } catch (err) {
      emitError(socket, err);
    }
  });
}
