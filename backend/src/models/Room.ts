import { Schema, model, type InferSchemaType } from 'mongoose';
import { DEFAULT_ROOM_SETTINGS } from '@uno/shared';

const PlayerSchema = new Schema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    displayName: { type: String, required: true },
    socketId: { type: String, default: null },
    connectionStatus: {
      type: String,
      enum: ['connected', 'reconnecting', 'disconnected'],
      default: 'connected',
    },
    seat: { type: Number, required: true },
    isHost: { type: Boolean, default: false },
    matchScore: { type: Number, default: 0 },
    teamId: { type: Number, enum: [0, 1, null], default: null },
  },
  { _id: false },
);

const RoomSettingsSchema = new Schema(
  {
    targetScore: { type: Number, default: DEFAULT_ROOM_SETTINGS.targetScore },
    variant112: { type: String, enum: ['off', 'swap', 'shuffle'], default: 'off' },
    customizableCount: { type: Number, default: 0 },
    customizableTexts: { type: [String], default: [] },
    twoPlayerHouseRules: { type: Boolean, default: false },
    reconnectGraceSeconds: {
      type: Number,
      default: DEFAULT_ROOM_SETTINGS.reconnectGraceSeconds,
    },
    teamMode: { type: Boolean, default: DEFAULT_ROOM_SETTINGS.teamMode },
  },
  { _id: false },
);

const RoomSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['lobby', 'in_progress', 'round_ended', 'match_ended'],
      default: 'lobby',
    },
    players: { type: [PlayerSchema], default: [] },
    settings: { type: RoomSettingsSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type RoomDocument = InferSchemaType<typeof RoomSchema>;
export const RoomModel = model('Room', RoomSchema);
