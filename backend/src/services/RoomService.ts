import { customAlphabet, nanoid } from 'nanoid';
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from '@uno/shared';
import { RoomModel } from '../models/Room';
import type { PlayerState } from '../game/types';
import { IllegalActionError } from '../game/types';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity
const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

export interface CreateRoomInput {
  userId: string;
  hostDisplayName: string;
  settings?: Partial<RoomSettings>;
}

export interface JoinRoomInput {
  roomCode: string;
  userId: string;
  playerId?: string;
  displayName: string;
  socketId: string | null;
}

function dedupeDisplayName(existing: { displayName: string }[], desired: string): string {
  const taken = new Set(existing.map((p) => p.displayName.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;
  let i = 2;
  while (taken.has(`${desired.toLowerCase()} (${i})`)) i++;
  return `${desired} (${i})`;
}

export class RoomService {
  async createRoom(input: CreateRoomInput) {
    let code = generateRoomCode();
    // Astronomically unlikely to collide, but keep it correct.
    while (await RoomModel.exists({ code })) {
      code = generateRoomCode();
    }

    const playerId = nanoid(12);
    const player: PlayerState = {
      id: playerId,
      userId: input.userId,
      displayName: input.hostDisplayName,
      socketId: null,
      connectionStatus: 'connected',
      seat: 0,
      isHost: true,
      matchScore: 0,
    };

    const room = await RoomModel.create({
      code,
      status: 'lobby',
      players: [player],
      settings: { ...DEFAULT_ROOM_SETTINGS, ...input.settings },
    });

    return { room, playerId };
  }

  async updateSettings(roomCode: string, hostPlayerId: string, settings: Partial<RoomSettings>) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) throw new IllegalActionError('room_not_found', 'No room with that code exists.');
    if (room.status !== 'lobby') {
      throw new IllegalActionError('already_started', 'Settings can only be changed before the game starts.');
    }
    const host = room.players.find((p) => p.id === hostPlayerId);
    if (!host?.isHost) {
      throw new IllegalActionError('not_host', 'Only the host can change room settings.');
    }
    Object.assign(room.settings, settings);
    await room.save();
    return room;
  }

  /** Sets the caller's own team in a Team Mode lobby — lobby-only, self-service. */
  async assignTeam(roomCode: string, playerId: string, teamId: 0 | 1) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) throw new IllegalActionError('room_not_found', 'No room with that code exists.');
    if (room.status !== 'lobby') {
      throw new IllegalActionError('already_started', 'Teams can only be chosen before the game starts.');
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new IllegalActionError('not_in_room', 'You are not seated in this room.');
    player.teamId = teamId;
    await room.save();
    return room;
  }

  async preflightStatus(roomCode: string): Promise<'lobby' | 'in_progress' | 'full' | 'not_found'> {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) return 'not_found';
    if (room.status !== 'lobby') return room.status === 'in_progress' ? 'in_progress' : 'lobby';
    if (room.players.length >= 10) return 'full';
    return 'lobby';
  }

  async joinRoom(input: JoinRoomInput) {
    const room = await RoomModel.findOne({ code: input.roomCode });
    if (!room) throw new IllegalActionError('room_not_found', 'No room with that code exists.');

    if (input.playerId) {
      const existing = room.players.find((p) => p.id === input.playerId);
      if (existing) {
        existing.socketId = input.socketId;
        existing.connectionStatus = 'connected';
        await room.save();
        return { room, player: existing, isReconnect: true };
      }
      // Unknown playerId (grace period elapsed / wrong room) — fall through to fresh join.
    }

    if (room.status !== 'lobby') {
      throw new IllegalActionError('room_not_joinable', 'This room has already started.');
    }
    if (room.players.length >= 10) {
      throw new IllegalActionError('room_full', 'This room is full.');
    }

    const playerId = nanoid(12);
    const displayName = dedupeDisplayName(room.players, input.displayName);
    const player: PlayerState = {
      id: playerId,
      userId: input.userId,
      displayName,
      socketId: input.socketId,
      connectionStatus: 'connected',
      seat: room.players.length,
      isHost: false,
      matchScore: 0,
    };
    room.players.push(player);
    await room.save();
    return { room, player, isReconnect: false };
  }

  async markConnectionStatus(roomCode: string, playerId: string, status: PlayerState['connectionStatus']) {
    const room = await RoomModel.findOne({ code: roomCode });
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.connectionStatus = status;
    if (status === 'disconnected') {
      player.socketId = null;
      this.transferHostIfNeeded(room);
    }
    await room.save();
    return room;
  }

  /** If the host is disconnected, hand the role to the first connected player. */
  transferHostIfNeeded(room: InstanceType<typeof RoomModel>) {
    const host = room.players.find((p) => p.isHost);
    if (!host || host.connectionStatus !== 'disconnected') return;
    const next = room.players.find((p) => p.connectionStatus !== 'disconnected' && !p.isHost);
    if (next) {
      host.isHost = false;
      next.isHost = true;
    }
  }

  async findByCode(roomCode: string) {
    return RoomModel.findOne({ code: roomCode });
  }
}

export const roomService = new RoomService();
