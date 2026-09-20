import { nanoid } from 'nanoid';
import type { Card, Color } from '@uno/shared';
import type { DeckOptions } from './types';

const COLORS: Exclude<Color, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

function card(color: Color, type: Card['type']): Card {
  return { id: nanoid(10), color, type };
}

/**
 * Builds a Uno deck. Defaults to the classic 108-card deck; passing
 * `includeSwapOrShuffle`/`customizableCount` builds the 112-card variant
 * (research.md "Deck variants" decision).
 */
export function buildDeck(options: DeckOptions = {}): Card[] {
  const cards: Card[] = [];

  for (const color of COLORS) {
    // one 0, two each of 1-9
    type NumberValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    cards.push(card(color, { kind: 'number', value: 0 }));
    for (let value = 1; value <= 9; value++) {
      cards.push(card(color, { kind: 'number', value: value as NumberValue }));
      cards.push(card(color, { kind: 'number', value: value as NumberValue }));
    }
    // two each of Skip, Reverse, Draw Two
    for (let i = 0; i < 2; i++) {
      cards.push(card(color, { kind: 'skip' }));
      cards.push(card(color, { kind: 'reverse' }));
      cards.push(card(color, { kind: 'draw_two' }));
    }
  }

  // 4 Wild, 4 Wild Draw Four
  for (let i = 0; i < 4; i++) {
    cards.push(card('wild', { kind: 'wild' }));
    cards.push(card('wild', { kind: 'wild_draw_four' }));
  }

  if (options.includeSwapOrShuffle === 'swap') {
    cards.push(card('wild', { kind: 'wild_swap_hands' }));
  } else if (options.includeSwapOrShuffle === 'shuffle') {
    cards.push(card('wild', { kind: 'wild_shuffle_hands' }));
  }

  const customizableCount = options.customizableCount ?? 0;
  for (let i = 0; i < customizableCount; i++) {
    const text = options.customizableTexts?.[i] ?? '';
    cards.push(card('wild', { kind: 'wild_customizable', text }));
  }

  return cards;
}

/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. */
export function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
