import { useEffect, useRef, useState } from 'react';
import {
  SOCKET_EVENTS,
  type GameErrorEvent,
  type GameView,
  type MatchEndedPayload,
  type RoomView,
  type RoundResultView,
} from '@uno/shared';
import { useSocket } from './useSocket';
import { getStoredIdentity, getStoredPlayerId, setStoredPlayerId } from '../services/identity';

export interface JoinAck {
  ok: boolean;
  playerId?: string;
}

/** Joins a room's socket session and keeps room/game state in sync — the single
 * source of live state for Lobby, Game, and RoundSummary. */
export function useGameState(roomCode: string, fallbackDisplayName: string) {
  const { socket, connected } = useSocket();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultView | null>(null);
  const [matchResult, setMatchResult] = useState<MatchEndedPayload | null>(null);
  const [error, setError] = useState<GameErrorEvent | null>(null);
  const [playerId, setPlayerId] = useState<string | undefined>(() => getStoredPlayerId(roomCode));
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || joinedRef.current === roomCode) return;
    const identity = getStoredIdentity();
    if (!identity) return;
    joinedRef.current = roomCode;

    socket.emit(
      SOCKET_EVENTS.ROOM_JOIN,
      {
        roomCode,
        userId: identity.userId,
        playerId: getStoredPlayerId(roomCode),
        displayName: fallbackDisplayName,
      },
      (ack: JoinAck) => {
        if (ack.ok && ack.playerId) {
          setStoredPlayerId(roomCode, ack.playerId);
          setPlayerId(ack.playerId);
        }
      },
    );
  }, [connected, roomCode, fallbackDisplayName, socket]);

  useEffect(() => {
    const onRoomState = (payload: RoomView) => setRoom(payload);
    const onGameState = (payload: GameView) => setGame(payload);
    const onRoundEnded = (payload: RoundResultView) => setRoundResult(payload);
    const onMatchEnded = (payload: MatchEndedPayload) => setMatchResult(payload);
    const onError = (payload: GameErrorEvent) => setError(payload);

    socket.on(SOCKET_EVENTS.ROOM_STATE, onRoomState);
    socket.on(SOCKET_EVENTS.GAME_STATE, onGameState);
    socket.on(SOCKET_EVENTS.GAME_ROUND_ENDED, onRoundEnded);
    socket.on(SOCKET_EVENTS.GAME_MATCH_ENDED, onMatchEnded);
    socket.on(SOCKET_EVENTS.GAME_ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE, onRoomState);
      socket.off(SOCKET_EVENTS.GAME_STATE, onGameState);
      socket.off(SOCKET_EVENTS.GAME_ROUND_ENDED, onRoundEnded);
      socket.off(SOCKET_EVENTS.GAME_MATCH_ENDED, onMatchEnded);
      socket.off(SOCKET_EVENTS.GAME_ERROR, onError);
    };
  }, [socket]);

  return {
    socket,
    room,
    game,
    roundResult,
    matchResult,
    error,
    playerId,
    clearError: () => setError(null),
  };
}
