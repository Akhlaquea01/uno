import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  type RoomJoinIntent,
  type RoomStartIntent,
  type RoomUpdateSettingsIntent,
  type RoomAssignTeamIntent,
  type NextRoundIntent,
} from '@uno/shared';
import { roomService } from '../services/RoomService';
import { gameService } from '../services/GameService';
import { GameModel } from '../models/Game';
import {
  broadcastGameState,
  broadcastRoomState,
  buildGameView,
  emitError,
  maybeScheduleAutoSkip,
  maybeScheduleChallengeAutoDecline,
} from './views';
import { clearAutoSkip } from '../services/reconnectTimers';

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
      clearAutoSkip(room.code, player.id);

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

  socket.on(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, async (payload: RoomUpdateSettingsIntent) => {
    try {
      const pid = session(socket).playerId;
      if (!pid) return;
      const room = await roomService.updateSettings(payload.roomCode, pid, payload.settings);
      broadcastRoomState(io, room);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, async (payload: RoomAssignTeamIntent) => {
    try {
      const pid = session(socket).playerId;
      if (!pid) return;
      const room = await roomService.assignTeam(payload.roomCode, pid, payload.teamId);
      broadcastRoomState(io, room);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_START, async (payload: RoomStartIntent) => {
    try {
      const pid = session(socket).playerId;
      if (!pid) return;
      const { room, game } = await gameService.startGame(payload.roomCode, pid);
      broadcastRoomState(io, room);
      broadcastGameState(io, room, game);
      maybeScheduleAutoSkip(io, room, game);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_NEXT_ROUND, async (payload: NextRoundIntent) => {
    try {
      const pid = session(socket).playerId;
      if (!pid) return;
      const { room, game } = await gameService.nextRound(payload.roomCode, pid);
      broadcastRoomState(io, room);
      broadcastGameState(io, room, game);
      maybeScheduleAutoSkip(io, room, game);
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

      if (room.status === 'in_progress') {
        const gameDoc = await GameModel.findOne({ roomCode });
        if (gameDoc) {
          maybeScheduleAutoSkip(io, room, gameDoc);
          maybeScheduleChallengeAutoDecline(io, room, gameDoc);
        }
      }
    }
  });
}
