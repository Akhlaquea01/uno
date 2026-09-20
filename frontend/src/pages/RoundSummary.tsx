import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RoomResultsResponse } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { api } from '../services/api';
import { useGameState } from '../hooks/useGameState';
import { getStoredIdentity } from '../services/identity';

export default function RoundSummary() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const identity = getStoredIdentity()!;
  const { socket, room, playerId } = useGameState(roomCode, identity.name);
  const [results, setResults] = useState<RoomResultsResponse | null>(null);

  useEffect(() => {
    api
      .roomResults(roomCode)
      .then(setResults)
      .catch(() => undefined);
  }, [roomCode, room?.status]);

  useEffect(() => {
    if (room?.status === 'in_progress') {
      navigate(`/room/${roomCode}/game`, { replace: true });
    }
  }, [room?.status, roomCode, navigate]);

  const isHost = room?.players.find((p) => p.id === playerId)?.isHost ?? false;
  const latestRound = results?.rounds[results.rounds.length - 1];
  const matchEnded = room?.status === 'match_ended';

  return (
    <div className="round-summary">
      <h1>{matchEnded ? 'Match over!' : 'Round over'}</h1>

      {latestRound && (
        <ul className="score-list">
          {latestRound.scores.map((s) => (
            <li key={s.playerId} className={s.playerId === latestRound.winnerId ? 'winner' : ''}>
              {s.displayName}: {s.playerId === latestRound.winnerId ? 'Won!' : `${s.cardsLeftValue} pts left`}
            </li>
          ))}
        </ul>
      )}

      <h2>Match score</h2>
      <ul className="score-list">
        {results?.matchScores
          .slice()
          .sort((a, b) => b.total - a.total)
          .map((s) => (
            <li key={s.playerId}>
              {s.displayName}: {s.total}
            </li>
          ))}
      </ul>

      {matchEnded ? (
        <button type="button" onClick={() => navigate('/')}>
          Back to home
        </button>
      ) : isHost ? (
        <button type="button" onClick={() => socket.emit(SOCKET_EVENTS.ROOM_NEXT_ROUND, { roomCode })}>
          Next round
        </button>
      ) : (
        <p>Waiting for the host to start the next round…</p>
      )}
    </div>
  );
}
