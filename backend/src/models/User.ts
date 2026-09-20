import { Schema, model, type InferSchemaType } from 'mongoose';

const StatsSchema = new Schema(
  {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    stats: { type: StatsSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;
export const UserModel = model('User', UserSchema);
