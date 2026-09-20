import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getStoredIdentity, setStoredPlayerId } from '../services/identity';

export default function Home() {
  const navigate = useNavigate();
  const identity = getStoredIdentity()!; // IdentityGate guarantees this exists.
  const [displayName, setDisplayName] = useState(identity.name);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createRoom = async () => {
    setError(null);
    if (!displayName.trim()) return setError('Enter a display name.');
    setBusy(true);
    try {
      const res = await api.createRoom({ userId: identity.userId, hostDisplayName: displayName.trim() });
      setStoredPlayerId(res.roomCode, res.playerId);
      navigate(`/room/${res.roomCode}/lobby`, { state: { displayName: displayName.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the room.');
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    setError(null);
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return setError('Enter a room code.');
    if (!displayName.trim()) return setError('Enter a display name.');
    setBusy(true);
    try {
      const preflight = await api.joinPreflight(code);
      if (preflight.status === 'not_found') return setError('No room with that code.');
      if (preflight.status === 'full') return setError('That room is full.');
      if (preflight.status === 'in_progress') return setError('That game has already started.');
      navigate(`/room/${code}/lobby`, { state: { displayName: displayName.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home">
      <h1>Uno</h1>

      <label className="field">
        Your name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
      </label>

      <section className="home-section">
        <button onClick={createRoom} disabled={busy}>
          Create a room
        </button>
      </section>

      <section className="home-section home-join">
        <input
          placeholder="Room code"
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button onClick={joinRoom} disabled={busy}>
          Join
        </button>
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
