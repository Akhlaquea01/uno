import type { Card, Color } from './events';

/** Whether `card` may be legally played on top of `topCard` given the table's
 * active color. Shared by the backend (authoritative enforcement) and the
 * frontend (playable-card highlighting) so the two never drift. */
export function isLegalPlay(card: Card, topCard: Card, activeColor: Color): boolean {
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.type.kind !== topCard.type.kind) return false;
  if (card.type.kind === 'number' && topCard.type.kind === 'number') {
    return card.type.value === topCard.type.value;
  }
  // Same action kind (skip/reverse/draw_two) matches regardless of color per the rules.
  return true;
}
