import { Router } from 'express';
import { z } from 'zod';
import type { CreateRoomRequest, CreateRoomResponse, JoinPreflightResponse, RoomResultsResponse, TeamId } from '@uno/shared';
import { roomService } from '../services/RoomService';
import { RoundResultModel } from '../models/RoundResult';
import { RoomModel } from '../models/Room';
import { IllegalActionError } from '../game/types';

export const roomsRouter = Router();

const createRoomSchema = z.object({
  userId: z.string().min(1),
  hostDisplayName: z.string().min(1).max(40),
  settings: z
    .object({
      targetScore: z.number().int().positive().optional(),
      variant112: z.enum(['off', 'swap', 'shuffle']).optional(),
      customizableCount: z.number().int().min(0).max(3).optional(),
      customizableTexts: z.array(z.string()).optional(),
      twoPlayerHouseRules: z.boolean().optional(),
      reconnectGraceSeconds: z.number().int().positive().optional(),
    })
    .partial()
    .optional(),
});

function handleError(res: import('express').Response, err: unknown) {
  if (err instanceof IllegalActionError) {
    return res.status(400).json({ code: err.code, message: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
}

roomsRouter.post('/rooms', async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body as CreateRoomRequest);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request body.', issues: parsed.error.issues });
  }
  try {
    const { userId, hostDisplayName, settings } = parsed.data;
    const { room, playerId } = await roomService.createRoom({ userId, hostDisplayName, settings });

    const body: CreateRoomResponse = {
      roomCode: room.code,
      playerId,
      joinUrl: `/room/${room.code}/lobby`,
    };
    res.status(201).json(body);
  } catch (err) {
    handleError(res, err);
  }
});

roomsRouter.post('/rooms/:code/join', async (req, res) => {
  try {
    const status = await roomService.preflightStatus(req.params.code.toUpperCase());
    const body: JoinPreflightResponse = { status };
    res.json(body);
  } catch (err) {
    handleError(res, err);
  }
});

roomsRouter.get('/rooms/:code/results', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await RoomModel.findOne({ code });
    if (!room) return res.status(404).json({ message: 'Room not found.' });

    const rounds = await RoundResultModel.find({ roomCode: code }).sort({ roundNumber: 1 });
    const body: RoomResultsResponse = {
      rounds: rounds.map((r) => ({
        roomCode: r.roomCode,
        roundNumber: r.roundNumber,
        winnerId: r.winnerId,
        winningTeamId: (r.winningTeamId ?? undefined) as TeamId | undefined,
        scores: r.scores.map((s) => ({
          playerId: s.playerId,
          displayName: s.displayName,
          cardsLeftValue: s.cardsLeftValue,
          teamId: (s.teamId ?? undefined) as TeamId | undefined,
        })),
        endedAt: (r.endedAt ?? new Date()).toISOString(),
      })),
      matchScores: room.players.map((p) => ({
        playerId: p.id,
        displayName: p.displayName,
        total: p.matchScore,
        teamId: (p.teamId ?? undefined) as TeamId | undefined,
      })),
    };
    res.json(body);
  } catch (err) {
    handleError(res, err);
  }
});
