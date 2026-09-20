import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SOCKET_EVENTS } from '@uno/shared';
import { useGameState } from '../hooks/useGameState';
import { getStoredIdentity } from '../services/identity';

export default function Lobby() {
  const { roomCode = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = getStoredIdentity()!;
  const fallbackDisplayName = (location.state as { displayName?: string } | null)?.displayName ?? identity.name;
  const { socket, room, playerId, error, clearError } = useGameState(roomCode, fallbackDisplayName);

  useEffect(() => {
    if (room && room.status !== 'lobby') {
      navigate(`/room/${roomCode}/game`, { replace: true });
    }
  }, [room, roomCode, navigate]);

  const isHost = room?.players.find((p) => p.id === playerId)?.isHost ?? false;
  const canStart = (room?.players.length ?? 0) >= 2;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomCode}/lobby` : '';

  return (
    <div className="lobby">
      <h1>Room {roomCode}</h1>
      <p className="share-hint">
        Share this link with friends: <code>{joinUrl}</code>
      </p>

      <ul className="player-list">
        {room?.players.map((p) => (
          <li key={p.id}>
            {p.displayName}
            {p.isHost ? ' · host' : ''}
            {p.id === playerId ? ' · you' : ''}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button disabled={!canStart} onClick={() => socket.emit(SOCKET_EVENTS.ROOM_START, { roomCode })}>
          {canStart ? 'Start game' : 'Waiting for at least 2 players…'}
        </button>
      ) : (
        <p>Waiting for the host to start…</p>
      )}

      {error && (
        <p className="error" onClick={clearError}>
          {error.message}
        </p>
      )}
    </div>
  );
}
