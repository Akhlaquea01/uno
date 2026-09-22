import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SOCKET_EVENTS, type RoomSettings, type Variant112 } from '@uno/shared';
import { useGameState } from '../hooks/useGameState';
import { getStoredIdentity } from '../services/identity';
import AppHeader from '../components/AppHeader';

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
  const teamMode = room?.settings.teamMode ?? false;
  const players = room?.players ?? [];
  const teamACount = players.filter((p) => p.teamId === 0).length;
  const teamBCount = players.filter((p) => p.teamId === 1).length;
  // Team Mode seats 4 players as 2v2, or 5 players as a 3-2 split (either team
  // may hold the extra player) — see GameService.arrangeTeamSeats on the backend.
  const validTeamSizes =
    players.length === 4
      ? [teamACount, teamBCount].sort().join(',') === '2,2'
      : players.length === 5
        ? [teamACount, teamBCount].sort().join(',') === '2,3'
        : false;
  const teamsReady = (players.length === 4 || players.length === 5) && validTeamSizes;
  const canStart = teamMode ? teamsReady : players.length >= 2;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomCode}/lobby` : '';

  const applySettings = () => {
    if (!settingsDraft) return;
    socket.emit(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, { roomCode, settings: settingsDraft });
  };

  const chooseTeam = (teamId: 0 | 1) => {
    socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId });
  };

  return (
    <div className="lobby">
      <AppHeader title="ROOM CODE" subtitle={roomCode} />
      <div className="page-content">
        <p className="share-hint">
          Share this link with friends: <code>{joinUrl}</code>
        </p>

        {!teamMode && (
          <ul className="player-list">
            {players.map((p) => (
              <li key={p.id}>
                {p.displayName}
                {p.isHost ? ' · host' : ''}
                {p.id === playerId ? ' · you' : ''}
              </li>
            ))}
          </ul>
        )}

        {teamMode && (
          <div className="team-picker">
            <p>
              {players.length === 4 || players.length === 5
                ? 'Pick your team'
                : `Team mode needs 4 or 5 players (${players.length} joined)`}
            </p>
            <div className="team-columns">
              {([0, 1] as const).map((teamId) => (
                <div key={teamId} className={`team-column team-${teamId}`}>
                  <h3>Team {teamId === 0 ? 'A' : 'B'}</h3>
                  <ul className="player-list">
                    {players
                      .filter((p) => p.teamId === teamId)
                      .map((p) => (
                        <li key={p.id}>
                          {p.displayName}
                          {p.isHost ? ' · host' : ''}
                          {p.id === playerId ? ' · you' : ''}
                        </li>
                      ))}
                  </ul>
                  {playerId && players.find((p) => p.id === playerId)?.teamId !== teamId && (
                    <button type="button" className="btn-outline" onClick={() => chooseTeam(teamId)}>
                      Join Team {teamId === 0 ? 'A' : 'B'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {players.some((p) => p.teamId === undefined) && (
              <p className="team-hint">
                {players.filter((p) => p.teamId === undefined).length} player(s) haven't picked a team yet.
              </p>
            )}
          </div>
        )}

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

          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={settingsDraft.teamMode}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, teamMode: e.target.checked })}
            />
            Team Mode (4 players 2v2, or 5 players 3v2)
          </label>

          <button type="button" className="btn-outline" onClick={applySettings}>
            Save settings
          </button>
        </fieldset>
        )}

        {isHost ? (
          <button
            className="btn-primary"
            disabled={!canStart}
            onClick={() => socket.emit(SOCKET_EVENTS.ROOM_START, { roomCode })}
          >
            {canStart
              ? 'Start game'
              : teamMode
                ? 'Waiting for 4 (2v2) or 5 (3v2) players, teams picked…'
                : 'Waiting for at least 2 players…'}
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
    </div>
  );
}
