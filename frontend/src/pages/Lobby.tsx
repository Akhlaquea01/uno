import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SOCKET_EVENTS, type RoomSettings, type Variant112 } from '@uno/shared';
import { useGameState } from '../hooks/useGameState';
import { getStoredIdentity } from '../services/identity';

export default function Lobby() {
  const { roomCode = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = getStoredIdentity()!;
  const fallbackDisplayName = (location.state as { displayName?: string } | null)?.displayName ?? identity.name;
  const { socket, room, playerId, error, clearError } = useGameState(roomCode, fallbackDisplayName);

  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null);

  useEffect(() => {
    if (room && room.status !== 'lobby') {
      navigate(`/room/${roomCode}/game`, { replace: true });
    }
  }, [room, roomCode, navigate]);

  // Pick up the latest settings from the server whenever they change, unless
  // the host has unsaved local edits in progress.
  useEffect(() => {
    if (room && !settingsDraft) setSettingsDraft(room.settings);
  }, [room, settingsDraft]);

  const isHost = room?.players.find((p) => p.id === playerId)?.isHost ?? false;
  const canStart = (room?.players.length ?? 0) >= 2;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomCode}/lobby` : '';

  const applySettings = () => {
    if (!settingsDraft) return;
    socket.emit(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, { roomCode, settings: settingsDraft });
  };

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

      {isHost && settingsDraft && (
        <fieldset className="room-settings">
          <legend>House rules (host only)</legend>

          <label className="field">
            Target score to win the match
            <input
              type="number"
              min={100}
              step={50}
              value={settingsDraft.targetScore}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, targetScore: Number(e.target.value) })}
            />
          </label>

          <label className="field">
            Extra Wild cards (112-card deck)
            <select
              value={settingsDraft.variant112}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, variant112: e.target.value as Variant112 })}
            >
              <option value="off">Off (classic 108-card deck)</option>
              <option value="swap">Include Wild Swap Hands</option>
              <option value="shuffle">Include Wild Shuffle Hands</option>
            </select>
          </label>

          {settingsDraft.variant112 !== 'off' && (
            <>
              <label className="field">
                Blank Wild Customizable cards (0-3)
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={settingsDraft.customizableCount}
                  onChange={(e) => {
                    const count = Math.min(3, Math.max(0, Number(e.target.value)));
                    const customizableTexts = Array.from(
                      { length: count },
                      (_, i) => settingsDraft.customizableTexts[i] ?? '',
                    );
                    setSettingsDraft({ ...settingsDraft, customizableCount: count, customizableTexts });
                  }}
                />
              </label>

              {Array.from({ length: settingsDraft.customizableCount }, (_, i) => (
                <label className="field" key={i}>
                  House rule #{i + 1} text
                  <input
                    placeholder="e.g. Everyone but you draws 2"
                    value={settingsDraft.customizableTexts[i] ?? ''}
                    maxLength={80}
                    onChange={(e) => {
                      const customizableTexts = [...settingsDraft.customizableTexts];
                      customizableTexts[i] = e.target.value;
                      setSettingsDraft({ ...settingsDraft, customizableTexts });
                    }}
                  />
                </label>
              ))}
            </>
          )}

          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={settingsDraft.twoPlayerHouseRules}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, twoPlayerHouseRules: e.target.checked })}
            />
            2-player rules (Reverse acts as Skip)
          </label>

          <button type="button" onClick={applySettings}>
            Save settings
          </button>
        </fieldset>
      )}

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
