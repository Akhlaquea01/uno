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
  onPlay: (cardId: string, chosenColor?: Exclude<Color, 'wild'>) => void;
}

export default function Hand({ cards, isMyTurn, mustPlayCardId, onPlay }: HandProps) {
  const [pendingWildId, setPendingWildId] = useState<string | null>(null);

  const handleClick = (card: CardType) => {
    if (mustPlayCardId && card.id !== mustPlayCardId) return;
    if (card.color === 'wild') {
      setPendingWildId(card.id);
      return;
    }
    onPlay(card.id);
  };

  const chooseColor = (color: Exclude<Color, 'wild'>) => {
    if (pendingWildId) onPlay(pendingWildId, color);
    setPendingWildId(null);
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

      {pendingWildId && (
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
    </div>
  );
}
