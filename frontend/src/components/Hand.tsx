import { useState } from 'react';
import type { Card as CardType, Color } from '@uno/shared';
import Card from './Card';

const REAL_COLORS: Exclude<Color, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

export interface HandProps {
  cards: CardType[];
  isMyTurn: boolean;
  /** Set when this player just drew a playable card and must play that exact
   * card or pass (pendingDrawDecision) — all other cards are disabled. */
  mustPlayCardId?: string | null;
  /** Other seated players, for the Wild Swap Hands target picker. */
  otherPlayers: { id: string; displayName: string }[];
  onPlay: (cardId: string, chosenColor?: Exclude<Color, 'wild'>, targetPlayerId?: string) => void;
}

export default function Hand({ cards, isMyTurn, mustPlayCardId, otherPlayers, onPlay }: HandProps) {
  const [pendingWildId, setPendingWildId] = useState<string | null>(null);
  const [pendingColor, setPendingColor] = useState<Exclude<Color, 'wild'> | null>(null);

  const pendingCard = cards.find((c) => c.id === pendingWildId);
  const needsTarget = pendingCard?.type.kind === 'wild_swap_hands';

  const reset = () => {
    setPendingWildId(null);
    setPendingColor(null);
  };

  const handleClick = (card: CardType) => {
    if (mustPlayCardId && card.id !== mustPlayCardId) return;
    if (card.color === 'wild') {
      setPendingWildId(card.id);
      return;
    }
    onPlay(card.id);
  };

  const chooseColor = (color: Exclude<Color, 'wild'>) => {
    if (!pendingWildId) return;
    if (needsTarget) {
      setPendingColor(color);
    } else {
      onPlay(pendingWildId, color);
      reset();
    }
  };

  const chooseTarget = (targetPlayerId: string) => {
    if (!pendingWildId || !pendingColor) return;
    onPlay(pendingWildId, pendingColor, targetPlayerId);
    reset();
  };

  return (
    <div className="hand">
      <div className="hand-strip">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            disabled={!isMyTurn || (!!mustPlayCardId && card.id !== mustPlayCardId)}
            onClick={() => handleClick(card)}
          />
        ))}
      </div>

      {pendingWildId && !(needsTarget && pendingColor) && (
        <div className="color-picker-overlay">
          <div className="color-picker">
            <p>Choose a color</p>
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
      )}

      {needsTarget && pendingColor && (
        <div className="color-picker-overlay">
          <div className="color-picker">
            <p>Swap hands with…</p>
            {otherPlayers.map((p) => (
              <button key={p.id} type="button" onClick={() => chooseTarget(p.id)}>
                {p.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
