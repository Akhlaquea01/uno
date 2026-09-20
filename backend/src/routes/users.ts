import { Router } from 'express';
import { z } from 'zod';
import type { CreateUserRequest, CreateUserResponse, UserStatsResponse } from '@uno/shared';
import { userService } from '../services/UserService';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1).max(60),
  email: z.string().min(3).max(254),
});

usersRouter.post('/users', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body as CreateUserRequest);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request body.', issues: parsed.error.issues });
  }
  const { name, email } = parsed.data;
  if (!userService.isValidEmail(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  try {
    const user = await userService.upsertByEmail(name, email);
    const body: CreateUserResponse = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      stats: user.stats,
    };
    res.status(200).json(body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

usersRouter.get('/users/:id/stats', async (req, res) => {
  const user = await userService.getById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const body: UserStatsResponse = { name: user.name, stats: user.stats };
  res.json(body);
});
