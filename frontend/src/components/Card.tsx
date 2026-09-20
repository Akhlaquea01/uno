import type { Card as CardType } from '@uno/shared';

function symbol(card: CardType): string {
  switch (card.type.kind) {
    case 'number':
      return String(card.type.value);
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw_two':
      return '+2';
    case 'wild':
      return 'W';
    case 'wild_draw_four':
      return '+4';
    case 'wild_swap_hands':
      return 'SWAP';
    case 'wild_shuffle_hands':
      return 'SHFL';
    case 'wild_customizable':
      return card.type.text || '?';
    default:
      return '?';
  }
}

function describe(card: CardType): string {
  switch (card.type.kind) {
    case 'number':
      return String(card.type.value);
    case 'skip':
      return 'skip';
    case 'reverse':
      return 'reverse';
    case 'draw_two':
      return 'draw two';
    case 'wild':
      return 'wild';
    case 'wild_draw_four':
      return 'wild draw four';
    case 'wild_swap_hands':
      return 'wild swap hands';
    case 'wild_shuffle_hands':
      return 'wild shuffle hands';
    case 'wild_customizable':
      return card.type.text ? `wild: ${card.type.text}` : 'blank wild';
    default:
      return 'card';
  }
}

export interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
  small?: boolean;
}

export default function Card({ card, onClick, disabled, faceDown, small }: CardProps) {
  if (faceDown) {
    return (
      <div className={`uno-card uno-card-back ${small ? 'uno-card-small' : ''}`} aria-hidden="true">
        <span>UNO</span>
      </div>
    );
  }

  const label = symbol(card);

  return (
    <button
      type="button"
      className={`uno-card card-${card.color} ${small ? 'uno-card-small' : ''}`}
      aria-label={`${describe(card)} ${card.color} card`}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <span className="card-corner">{label}</span>
      <span className="card-oval" aria-hidden="true">
        <span>{label}</span>
      </span>
      <span className="card-corner card-corner-bottom">{label}</span>
    </button>
  );
}
