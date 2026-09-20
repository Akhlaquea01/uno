import type { Server, Socket } from 'socket.io';
import type { Card, GameErrorEvent, GameView, RoomView } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { IllegalActionError } from '../game/types';

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

export function emitError(socket: Socket, err: unknown): void {
  const payload: GameErrorEvent =
    err instanceof IllegalActionError
      ? { code: err.code, message: err.message }
      : { code: 'internal_error', message: err instanceof Error ? err.message : 'Something went wrong.' };
  socket.emit(SOCKET_EVENTS.GAME_ERROR, payload);
}
