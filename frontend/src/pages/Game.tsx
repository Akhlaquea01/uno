import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SOCKET_EVENTS, type Color } from '@uno/shared';
import { useGameState } from '../hooks/useGameState';
import { getStoredIdentity } from '../services/identity';
import OrientationGate from '../components/OrientationGate';
import Card from '../components/Card';
import Hand from '../components/Hand';
import GameControls from '../components/GameControls';

const REAL_COLORS: Exclude<Color, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

export default function Game() {
  const { roomCode = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = getStoredIdentity()!;
  const fallbackDisplayName = (location.state as { displayName?: string } | null)?.displayName ?? identity.name;
  const { socket, room, game, playerId, error, clearError } = useGameState(roomCode, fallbackDisplayName);

  useEffect(() => {
    if (room?.status === 'lobby') {
      navigate(`/room/${roomCode}/lobby`, { replace: true });
    } else if (room?.status === 'round_ended' || room?.status === 'match_ended') {
      navigate(`/room/${roomCode}/summary`, { replace: true });
    }
  }, [room?.status, roomCode, navigate]);

  if (!room || !game) {
    return (
      <div className="game-loading">
        <p>Loading game…</p>
      </div>
    );
  }

  const isMyTurn = game.turnPlayerId === playerId;
  const awaitingStartColor = game.activeColor === 'wild';
  const iChooseStartColor = awaitingStartColor && isMyTurn;
  const myPendingDraw = game.pendingDrawDecision?.playerId === playerId ? game.pendingDrawDecision : null;

  return (
    <OrientationGate>
      <div className="game-page">
        <div className="opponent-strip">
          {room.players.map((p) => (
            <div key={p.id} className={`opponent ${p.id === game.turnPlayerId ? 'active-turn' : ''}`}>
              <span className="opponent-name">{p.displayName}</span>
              <span className="opponent-count">{game.handCounts[p.id] ?? 0} cards</span>
              {p.connectionStatus !== 'connected' && <span className="reconnecting">reconnecting…</span>}
            </div>
          ))}
        </div>

        <div className="table">
          <div className="draw-pile" aria-label={`${game.drawPileCount} cards left in the draw pile`}>
            {game.drawPileCount}
          </div>
          <div className="discard-pile">
            {game.discardTop && <Card card={game.discardTop} />}
            <span className={`active-color-swatch color-${game.activeColor}`} />
          </div>
        </div>

        {awaitingStartColor && (
          <div className="color-picker-overlay">
            <div className="color-picker">
              <p>{iChooseStartColor ? 'Choose the starting color' : `Waiting for ${game.turnPlayerId === playerId ? 'you' : 'the starting player'} to choose a color…`}</p>
              {iChooseStartColor &&
                REAL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch color-${color}`}
                    onClick={() => socket.emit(SOCKET_EVENTS.GAME_CHOOSE_START_COLOR, { roomCode, color })}
                  >
                    {color}
                  </button>
                ))}
            </div>
          </div>
        )}

        <GameControls
          game={game}
          room={room}
          myPlayerId={playerId}
          onDraw={() => socket.emit(SOCKET_EVENTS.GAME_DRAW_CARD, { roomCode })}
          onPass={() => socket.emit(SOCKET_EVENTS.GAME_PASS_TURN, { roomCode })}
          onCallUno={() => socket.emit(SOCKET_EVENTS.GAME_CALL_UNO, { roomCode })}
          onCatchUno={(targetPlayerId) => socket.emit(SOCKET_EVENTS.GAME_CATCH_UNO, { roomCode, targetPlayerId })}
          onChallenge={() => socket.emit(SOCKET_EVENTS.GAME_CHALLENGE_WILD_DRAW_FOUR, { roomCode })}
        />

        <Hand
          cards={game.hand}
          isMyTurn={isMyTurn && !awaitingStartColor}
          mustPlayCardId={myPendingDraw?.cardId ?? null}
          onPlay={(cardId, chosenColor) =>
            socket.emit(SOCKET_EVENTS.GAME_PLAY_CARD, { roomCode, cardId, chosenColor })
          }
        />

        {error && (
          <p className="error toast" onClick={clearError}>
            {error.message}
          </p>
        )}
      </div>
    </OrientationGate>
  );
}
