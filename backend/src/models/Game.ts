import { Schema, model, type InferSchemaType } from 'mongoose';

const CardSchema = new Schema(
  {
    id: { type: String, required: true },
    color: { type: String, enum: ['red', 'yellow', 'green', 'blue', 'wild'], required: true },
    type: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const PendingUnoCallSchema = new Schema(
  {
    playerId: { type: String, required: true },
  },
  { _id: false },
);

const PendingChallengeSchema = new Schema(
  {
    playerId: { type: String, required: true },
    hadLegalAlternative: { type: Boolean, required: true },
    targetPlayerId: { type: String, required: true },
    drawnCardIds: { type: [String], default: [] },
  },
  { _id: false },
);

const PendingDrawDecisionSchema = new Schema(
  {
    playerId: { type: String, required: true },
    cardId: { type: String, required: true },
  },
  { _id: false },
);

const GameSchema = new Schema(
  {
    roomCode: { type: String, required: true, unique: true, index: true },
    version: { type: Number, required: true, default: 0 },
    roundNumber: { type: Number, required: true, default: 1 },
    deck: { type: [CardSchema], default: [] },
    discardPile: { type: [CardSchema], default: [] },
    hands: { type: Map, of: [CardSchema], default: () => new Map() },
    activeColor: { type: String, enum: ['red', 'yellow', 'green', 'blue', 'wild'], required: true },
    turnOrder: { type: [String], default: [] },
    turnIndex: { type: Number, default: 0 },
    direction: { type: Number, enum: [1, -1], default: 1 },
    pendingUnoCall: { type: PendingUnoCallSchema, default: null },
    pendingChallenge: { type: PendingChallengeSchema, default: null },
    pendingDrawDecision: { type: PendingDrawDecisionSchema, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export type GameDocument = InferSchemaType<typeof GameSchema>;
export const GameModel = model('Game', GameSchema);
