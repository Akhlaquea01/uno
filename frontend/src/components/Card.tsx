import type { Card as CardType } from '@uno/shared';

const COLOR_HEX: Record<CardType['color'], string> = {
  red: '#e63946',
  yellow: '#f4c430',
  green: '#2a9d3f',
  blue: '#1d6fd6',
  wild: '#2b2d31',
};

function label(card: CardType): string {
  switch (card.type.kind) {
    case 'number':
      return String(card.type.value);
    case 'skip':
      return '⦸';
    case 'reverse':
      return '⇄';
    case 'draw_two':
      return '+2';
    case 'wild':
      return 'WILD';
    case 'wild_draw_four':
      return '+4';
    case 'wild_swap_hands':
      return 'SWAP';
    case 'wild_shuffle_hands':
      return 'SHUFFLE';
    case 'wild_customizable':
      return card.type.text || '?';
    default:
      return '?';
  }
}

export interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
}

export default function Card({ card, onClick, disabled, faceDown }: CardProps) {
  if (faceDown) {
    return <div className="uno-card uno-card-back" aria-hidden="true" />;
  }
  return (
    <button
      type="button"
      className="uno-card"
      style={{ backgroundColor: COLOR_HEX[card.color] }}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <span className="uno-card-label">{label(card)}</span>
    </button>
  );
}
