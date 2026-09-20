import { motion } from 'framer-motion';
import { Plus, Check, ShieldAlert, ShieldCheck, Hand as HandIcon, SkipForward } from 'lucide-react';
import type { GameView, RoomView } from '@uno/shared';
import { playUnoCall } from '../services/sound';

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

  const callUno = () => {
    playUnoCall();
    onCallUno();
  };

  return (
    <div className="game-controls">
      {isMyTurn && !iMustDecide && !game.pendingChallenge && (
        <motion.button type="button" className="draw-button" onClick={onDraw} whileTap={{ scale: 0.94 }}>
          <Plus /> Draw card
        </motion.button>
      )}
      {iMustDecide && (
        <motion.button type="button" className="draw-button" onClick={onPass} whileTap={{ scale: 0.94 }}>
          <SkipForward /> Pass
        </motion.button>
      )}
      {iCanChallenge && (
        <>
          <motion.button type="button" className="challenge-btn" onClick={onChallenge} whileTap={{ scale: 0.94 }}>
            <ShieldAlert /> Challenge!
          </motion.button>
          <motion.button type="button" className="accept-btn" onClick={onDeclineChallenge} whileTap={{ scale: 0.94 }}>
            <ShieldCheck /> Accept the draw
          </motion.button>
        </>
      )}
      {iCanCallUno && (
        <motion.button
          type="button"
          className="uno-button"
          onClick={callUno}
          whileTap={{ scale: 0.9 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <Check /> UNO
        </motion.button>
      )}
      {catchTarget && (
        <motion.button type="button" className="catch-btn" onClick={() => onCatchUno(catchTarget.id)} whileTap={{ scale: 0.94 }}>
          <HandIcon /> Catch {catchTarget.displayName}!
        </motion.button>
      )}
    </div>
  );
}
