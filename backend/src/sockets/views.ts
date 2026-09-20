import type { Server, Socket } from 'socket.io';
import type { Card, GameErrorEvent, GameView, RoomView } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { IllegalActionError } from '../game/types';
import { gameService } from '../services/GameService';
import { RoomModel } from '../models/Room';
import { scheduleAutoSkip } from '../services/reconnectTimers';

export function buildRoomView(room: any): RoomView {
  return {
    code: room.code,
    status: room.status,
    players: room.players.map((p: any) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      connectionStatus: p.connectionStatus,
      seat: p.seat,
      isHost: p.isHost,
      matchScore: p.matchScore,
      handCount: 0,
      teamId: p.teamId ?? undefined,
    })),
    settings: room.settings,
    createdAt: (room.createdAt ?? new Date()).toISOString?.() ?? new Date().toISOString(),
  };
}

export function buildGameView(game: any, room: any, forPlayerId: string): GameView {
  const handsObj: Record<string, Card[]> = game.hands instanceof Map ? Object.fromEntries(game.hands) : game.hands ?? {};
  const handCounts: Record<string, number> = {};
  for (const [pid, hand] of Object.entries(handsObj)) handCounts[pid] = (hand as Card[]).length;
  const topCard = game.discardPile[game.discardPile.length - 1] ?? null;

  return {
    roomCode: game.roomCode,
    version: game.version,
    hand: (handsObj[forPlayerId] as Card[]) ?? [],
    handCounts,
    discardTop: topCard,
    activeColor: game.activeColor,
    turnIndex: game.turnIndex,
    turnPlayerId: game.turnOrder[game.turnIndex],
    direction: game.direction,
    pendingUnoCall: game.pendingUnoCall ?? null,
    pendingChallenge: game.pendingChallenge
      ? {
          playerId: game.pendingChallenge.playerId,
          hadLegalAlternative: game.pendingChallenge.hadLegalAlternative,
          targetPlayerId: game.pendingChallenge.targetPlayerId,
        }
      : null,
    pendingDrawDecision: game.pendingDrawDecision
      ? { playerId: game.pendingDrawDecision.playerId, cardId: game.pendingDrawDecision.cardId }
      : null,
    drawPileCount: game.deck.length,
    status: room.status,
  };
}

/** Sends each seated, connected player their own scoped GameView (never a shared broadcast — hands differ per player). */
export function broadcastGameState(io: Server, room: any, game: any): void {
  for (const player of room.players) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit(SOCKET_EVENTS.GAME_STATE, buildGameView(game, room, player.id));
  }
}

export function broadcastRoomState(io: Server, room: any): void {
  io.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE, buildRoomView(room));
}

/** If the turn has landed on a player who is (still) disconnected, (re)start
 * their grace-period timer — covers the case where they weren't up yet at
 * the moment they disconnected (FR-013). Idempotent: safe to call after
 * every broadcast. */
export function maybeScheduleAutoSkip(io: Server, room: any, game: any): void {
  const turnPlayerId = game.turnOrder[game.turnIndex];
  const player = room.players.find((p: any) => p.id === turnPlayerId);
  if (!player || player.connectionStatus !== 'disconnected') return;

  scheduleAutoSkip(room.code, turnPlayerId, room.settings.reconnectGraceSeconds, async () => {
    const outcome = await gameService.autoSkipTurn(room.code, turnPlayerId);
    if (!outcome) return;
    const freshRoom = await RoomModel.findOne({ code: room.code });
    if (freshRoom) {
      broadcastGameState(io, freshRoom, outcome.game);
      maybeScheduleAutoSkip(io, freshRoom, outcome.game);
    }
  });
}

/** If a Wild Draw Four challenge is pending against a disconnected target,
 * arm their grace-period timer to auto-decline (accept the draw) once it
 * elapses — otherwise a target who disconnects right after being hit could
 * leave the challenge (and everyone's next action) stuck forever. */
export function maybeScheduleChallengeAutoDecline(io: Server, room: any, game: any): void {
  const pending = game.pendingChallenge;
  if (!pending) return;
  const target = room.players.find((p: any) => p.id === pending.targetPlayerId);
  if (!target || target.connectionStatus !== 'disconnected') return;

  scheduleAutoSkip(room.code, pending.targetPlayerId, room.settings.reconnectGraceSeconds, async () => {
    let outcome: Awaited<ReturnType<typeof gameService.declineChallenge>> | null = null;
    try {
      outcome = await gameService.declineChallenge(room.code, pending.targetPlayerId);
    } catch {
      return; // already resolved (reconnected and acted, or resolved some other way)
    }
    const freshRoom = await RoomModel.findOne({ code: room.code });
    if (freshRoom) {
      broadcastGameState(io, freshRoom, outcome.game);
      maybeScheduleAutoSkip(io, freshRoom, outcome.game);
    }
  });
}

export function emitError(socket: Socket, err: unknown): void {
  const payload: GameErrorEvent =
    err instanceof IllegalActionError
      ? { code: err.code, message: err.message }
      : { code: 'internal_error', message: err instanceof Error ? err.message : 'Something went wrong.' };
  socket.emit(SOCKET_EVENTS.GAME_ERROR, payload);
}
