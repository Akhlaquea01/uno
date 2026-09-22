import { useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { isLegalPlay, type Card as CardType, type Color } from '@uno/shared';
import Card from './Card';
import { playCardSound } from '../services/sound';

const REAL_COLORS: Exclude<Color, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

/** Dragging a card up past this many pixels counts as "play it", mirroring
 * the flick-to-play gesture of real UNO apps. */
const PLAY_DRAG_THRESHOLD = -70;

export interface HandProps {
  cards: CardType[];
  isMyTurn: boolean;
  /** Set when this player just drew a playable card and must play that exact
   * card or pass (pendingDrawDecision) — all other cards are disabled. */
  mustPlayCardId?: string | null;
  /** Current discard-pile top card and active color, used to dim/disable cards
   * that can't legally be played — so tapping is a genuine "pick from your
   * playable cards" instead of a blind guess that bounces off a server error. */
  topCard?: CardType | null;
  activeColor?: Color;
  /** Other seated players, for the Wild Swap Hands target picker. */
  otherPlayers: { id: string; displayName: string }[];
  onPlay: (cardId: string, chosenColor?: Exclude<Color, 'wild'>, targetPlayerId?: string) => void;
}

/** Spreads the hand into a fan: wider hands get a flatter spread so cards
 * stay legible instead of overlapping into an unreadable stack. */
function fanValues(index: number, total: number): { rotate: number; y: number } {
  if (total <= 1) return { rotate: 0, y: 0 };
  const spread = Math.min(46, 6 + total * 3.5);
  const step = spread / (total - 1);
  const angle = -spread / 2 + index * step;
  return { rotate: angle, y: Math.abs(angle) * 0.55 };
}

export default function Hand({ cards, isMyTurn, mustPlayCardId, topCard, activeColor, otherPlayers, onPlay }: HandProps) {
  const [pendingWildId, setPendingWildId] = useState<string | null>(null);
  const [pendingColor, setPendingColor] = useState<Exclude<Color, 'wild'> | null>(null);

  const pendingCard = cards.find((c) => c.id === pendingWildId);
  const needsTarget = pendingCard?.type.kind === 'wild_swap_hands';

  const reset = () => {
    setPendingWildId(null);
    setPendingColor(null);
  };

  const attemptPlay = (card: CardType, disabled: boolean) => {
    if (disabled) return;
    if (card.color === 'wild') {
      setPendingWildId(card.id);
      return;
    }
    playCardSound();
    onPlay(card.id);
  };

  const chooseColor = (color: Exclude<Color, 'wild'>) => {
    if (!pendingWildId) return;
    if (needsTarget) {
      setPendingColor(color);
    } else {
      playCardSound();
      onPlay(pendingWildId, color);
      reset();
    }
  };

  const chooseTarget = (targetPlayerId: string) => {
    if (!pendingWildId || !pendingColor) return;
    playCardSound();
    onPlay(pendingWildId, pendingColor, targetPlayerId);
    reset();
  };

  return (
    <div className="hand">
      <div className="card-hand">
        <AnimatePresence initial={false}>
          {cards.map((card, index) => {
            const { rotate, y } = fanValues(index, cards.length);
            const outOfTurn = !isMyTurn || (!!mustPlayCardId && card.id !== mustPlayCardId);
            // Once a specific card is forced (mustPlayCardId), legality is already
            // guaranteed by the server, so only the turn/forced-card gate applies.
            const illegal = !outOfTurn && !mustPlayCardId && !!topCard && !!activeColor && !isLegalPlay(card, topCard, activeColor);
            const disabled = outOfTurn || illegal;
            const handlePlay = () => attemptPlay(card, disabled);
            return (
              <motion.div
                key={card.id}
                layout
                className="card-slot"
                style={{ rotate, y, zIndex: index }}
                initial={{ opacity: 0, scale: 0.5, y: y + 50 }}
                animate={{ opacity: 1, scale: 1, y }}
                exit={{ opacity: 0, scale: 0.6, y: y - 120, transition: { duration: 0.24, ease: 'easeOut' } }}
                transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.9 }}
                drag={!disabled}
                dragSnapToOrigin
                dragElastic={0.3}
                dragMomentum={false}
                dragTransition={{ bounceStiffness: 480, bounceDamping: 26 }}
                whileDrag={{ scale: 1.12, rotate: 0, zIndex: 30, transition: { type: 'spring', stiffness: 500, damping: 32 } }}
                whileHover={!disabled ? { y: y - 10, transition: { type: 'spring', stiffness: 400, damping: 24 } } : undefined}
                onDragEnd={(_e, info: PanInfo) => {
                  if (info.offset.y < PLAY_DRAG_THRESHOLD) handlePlay();
                }}
                onTap={handlePlay}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handlePlay();
                  }
                }}
              >
                <Card card={card} disabled={disabled} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {pendingWildId && !(needsTarget && pendingColor) && (
        <div className="color-picker-overlay">
          <div className="color-picker">
            <p>Choose a color</p>
            <div className="color-swatch-grid">
              {REAL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch color-${color}`}
                  onClick={() => chooseColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {needsTarget && pendingColor && (
        <div className="color-picker-overlay">
          <div className="color-picker">
            <p>Swap hands with…</p>
            {otherPlayers.map((p) => (
              <button key={p.id} type="button" className="btn-outline" onClick={() => chooseTarget(p.id)}>
                {p.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
