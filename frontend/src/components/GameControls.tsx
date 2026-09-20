import type { GameView, RoomView } from '@uno/shared';

export interface GameControlsProps {
  game: GameView;
  room: RoomView;
  myPlayerId?: string;
  onDraw: () => void;
  onPass: () => void;
  onCallUno: () => void;
  onCatchUno: (targetPlayerId: string) => void;
  onChallenge: () => void;
}

export default function GameControls({
  game,
  room,
  myPlayerId,
  onDraw,
  onPass,
  onCallUno,
  onCatchUno,
  onChallenge,
}: GameControlsProps) {
  const isMyTurn = game.turnPlayerId === myPlayerId;
  const iMustDecide = game.pendingDrawDecision?.playerId === myPlayerId;
  const iCanCallUno = game.pendingUnoCall?.playerId === myPlayerId;
  const iCanChallenge = game.pendingChallenge?.targetPlayerId === myPlayerId;

  const catchTarget = room.players.find(
    (p) => p.id === game.pendingUnoCall?.playerId && p.id !== myPlayerId,
  );

  return (
    <div className="game-controls">
      {isMyTurn && !iMustDecide && !game.pendingChallenge && (
        <button type="button" onClick={onDraw}>
          Draw
        </button>
      )}
      {iMustDecide && (
        <button type="button" onClick={onPass}>
          Pass
        </button>
      )}
      {iCanChallenge && (
        <button type="button" className="challenge-btn" onClick={onChallenge}>
          Challenge!
        </button>
      )}
      {iCanCallUno && (
        <button type="button" className="uno-btn" onClick={onCallUno}>
          UNO!
        </button>
      )}
      {catchTarget && (
        <button type="button" className="catch-btn" onClick={() => onCatchUno(catchTarget.id)}>
          Catch {catchTarget.displayName}!
        </button>
      )}
    </div>
  );
}
