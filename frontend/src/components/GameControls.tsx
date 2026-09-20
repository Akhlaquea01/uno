import { Plus, Check, ShieldAlert, ShieldCheck, Hand as HandIcon, SkipForward } from 'lucide-react';
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
  onDeclineChallenge: () => void;
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
  onDeclineChallenge,
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
        <button type="button" className="draw-button" onClick={onDraw}>
          <Plus /> Draw card
        </button>
      )}
      {iMustDecide && (
        <button type="button" className="draw-button" onClick={onPass}>
          <SkipForward /> Pass
        </button>
      )}
      {iCanChallenge && (
        <>
          <button type="button" className="challenge-btn" onClick={onChallenge}>
            <ShieldAlert /> Challenge!
          </button>
          <button type="button" className="accept-btn" onClick={onDeclineChallenge}>
            <ShieldCheck /> Accept the draw
          </button>
        </>
      )}
      {iCanCallUno && (
        <button type="button" className="uno-button" onClick={onCallUno}>
          <Check /> UNO
        </button>
      )}
      {catchTarget && (
        <button type="button" className="catch-btn" onClick={() => onCatchUno(catchTarget.id)}>
          <HandIcon /> Catch {catchTarget.displayName}!
        </button>
      )}
    </div>
  );
}
