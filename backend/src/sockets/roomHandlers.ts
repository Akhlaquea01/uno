import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, type RoomJoinIntent, type RoomStartIntent, type NextRoundIntent } from '@uno/shared';
import { roomService } from '../services/RoomService';
import { gameService } from '../services/GameService';
import { GameModel } from '../models/Game';
import { broadcastGameState, broadcastRoomState, buildGameView, emitError } from './views';

export interface SocketSessionData {
  roomCode?: string;
  playerId?: string;
}

function session(socket: Socket): SocketSessionData {
  return socket.data as SocketSessionData;
}

export function registerRoomHandlers(io: Server, socket: Socket): void {
  socket.on(SOCKET_EVENTS.ROOM_JOIN, async (payload: RoomJoinIntent, ack?: (res: unknown) => void) => {
    try {
      const { room, player } = await roomService.joinRoom({
        roomCode: payload.roomCode,
        userId: payload.userId,
        playerId: payload.playerId,
        displayName: payload.displayName,
        socketId: socket.id,
      });

      session(socket).roomCode = room.code;
      session(socket).playerId = player.id;
      socket.join(room.code);

      broadcastRoomState(io, room);
      ack?.({ ok: true, playerId: player.id });

      if (room.status !== 'lobby') {
        const gameDoc = await GameModel.findOne({ roomCode: room.code });
        if (gameDoc) {
          socket.emit(SOCKET_EVENTS.GAME_STATE, buildGameView(gameDoc, room, player.id));
        }
      }
    } catch (err) {
      emitError(socket, err);
      ack?.({ ok: false });
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_START, async (payload: RoomStartIntent) => {
    try {
      const { room, game } = await gameService.startGame(payload.roomCode);
      broadcastRoomState(io, room);
      broadcastGameState(io, room, game);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_NEXT_ROUND, async (payload: NextRoundIntent) => {
    try {
      const { room, game } = await gameService.nextRound(payload.roomCode);
      broadcastRoomState(io, room);
      broadcastGameState(io, room, game);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('disconnect', async () => {
    const { roomCode, playerId } = session(socket);
    if (!roomCode || !playerId) return;
    const room = await roomService.markConnectionStatus(roomCode, playerId, 'disconnected');
    if (room) {
      broadcastRoomState(io, room);
      io.to(roomCode).emit(SOCKET_EVENTS.PLAYER_PRESENCE, { playerId, connectionStatus: 'disconnected' });
    }
  });
}
