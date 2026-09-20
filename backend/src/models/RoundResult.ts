import { Schema, model, type InferSchemaType } from 'mongoose';

const ScoreEntrySchema = new Schema(
  {
    playerId: { type: String, required: true },
    displayName: { type: String, required: true },
    cardsLeftValue: { type: Number, required: true },
    teamId: { type: Number, enum: [0, 1, null], default: null },
  },
  { _id: false },
);

const RoundResultSchema = new Schema(
  {
    roomCode: { type: String, required: true, index: true },
    roundNumber: { type: Number, required: true },
    winnerId: { type: String, required: true },
    winningTeamId: { type: Number, enum: [0, 1, null], default: null },
    scores: { type: [ScoreEntrySchema], default: [] },
    endedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

export type RoundResultDocument = InferSchemaType<typeof RoundResultSchema>;
export const RoundResultModel = model('RoundResult', RoundResultSchema);
