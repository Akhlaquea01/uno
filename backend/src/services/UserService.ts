import { UserModel } from '../models/User';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UserService {
  isValidEmail(email: string): boolean {
    return EMAIL_RE.test(email);
  }

  /** Creates a User keyed by email, or matches (and refreshes the name of) an existing one. */
  async upsertByEmail(name: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    return UserModel.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: { name }, $setOnInsert: { email: normalizedEmail } },
      { new: true, upsert: true },
    );
  }

  async getById(userId: string) {
    return UserModel.findById(userId);
  }

  /** Adds to a user's lifetime totalScore — called for the round winner at round end (FR-021). */
  async addRoundScore(userId: string, delta: number): Promise<void> {
    if (delta === 0) return;
    await UserModel.findByIdAndUpdate(userId, { $inc: { 'stats.totalScore': delta } });
  }

  /** Increments gamesPlayed for everyone seated, and gamesWon for the match winner (FR-021). */
  async recordMatchCompletion(userIds: string[], winnerUserId: string): Promise<void> {
    await UserModel.updateMany({ _id: { $in: userIds } }, { $inc: { 'stats.gamesPlayed': 1 } });
    await UserModel.findByIdAndUpdate(winnerUserId, { $inc: { 'stats.gamesWon': 1 } });
  }
}

export const userService = new UserService();
