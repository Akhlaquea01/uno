import { AnimatePresence, motion } from 'framer-motion';
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

  const enter = { initial: { opacity: 0, scale: 0.8, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.8, y: 8 }, transition: { type: 'spring' as const, stiffness: 420, damping: 30 } };

  return (
    <div className="game-controls">
      <AnimatePresence mode="popLayout">
        {isMyTurn && !iMustDecide && !game.pendingChallenge && (
          <motion.button key="draw" type="button" className="draw-button" onClick={onDraw} whileTap={{ scale: 0.94 }} {...enter}>
            <Plus /> Draw card
          </motion.button>
        )}
        {iMustDecide && (
          <motion.button key="pass" type="button" className="draw-button" onClick={onPass} whileTap={{ scale: 0.94 }} {...enter}>
            <SkipForward /> Pass
          </motion.button>
        )}
        {iCanChallenge && (
          <motion.button key="challenge" type="button" className="challenge-btn" onClick={onChallenge} whileTap={{ scale: 0.94 }} {...enter}>
            <ShieldAlert /> Challenge!
          </motion.button>
        )}
        {iCanChallenge && (
          <motion.button key="accept" type="button" className="accept-btn" onClick={onDeclineChallenge} whileTap={{ scale: 0.94 }} {...enter}>
            <ShieldCheck /> Accept the draw
          </motion.button>
        )}
        {iCanCallUno && (
          <motion.button
            key="uno"
            type="button"
            className="uno-button"
            onClick={callUno}
            whileTap={{ scale: 0.9 }}
            initial={enter.initial}
            exit={enter.exit}
            animate={{ opacity: 1, scale: [1, 1.06, 1], y: 0 }}
            transition={{ scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } }}
          >
            <Check /> UNO
          </motion.button>
        )}
        {catchTarget && (
          <motion.button key="catch" type="button" className="catch-btn" onClick={() => onCatchUno(catchTarget.id)} whileTap={{ scale: 0.94 }} {...enter}>
            <HandIcon /> Catch {catchTarget.displayName}!
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
