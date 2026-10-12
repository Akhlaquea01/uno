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
  /** Visual-only dimming — interactivity (click/drag/keyboard) is handled by
   * the caller, since Hand wraps each card in a draggable motion element. */
  disabled?: boolean;
  faceDown?: boolean;
  /** Compact tile showing only the corner symbol — used for a teammate's face-up hand. */
  mini?: boolean;
}

export default function Card({ card, disabled, faceDown, mini }: CardProps) {
  if (faceDown) {
    return (
      <div className={`uno-card uno-card-back ${mini ? 'uno-card-mini' : ''}`} aria-hidden="true">
        <span>UNO</span>
      </div>
    );
  }

  const label = symbol(card);

  if (mini) {
    return (
      <div
        className={`uno-card uno-card-mini card-${card.color}`}
        aria-label={`${describe(card)} ${card.color} card`}
      >
        <span className="card-corner">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={`uno-card card-${card.color} ${disabled ? 'uno-card-disabled' : ''}`}
      aria-label={`${describe(card)} ${card.color} card`}
    >
      <span className="card-corner">{label}</span>
      <span className="card-oval" aria-hidden="true">
        <span>{label}</span>
      </span>
      <span className="card-corner card-corner-bottom">{label}</span>
    </div>
  );
}
