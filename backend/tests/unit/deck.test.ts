import { describe, it, expect } from 'vitest';
import { buildDeck, shuffle } from '../../src/game/deck';

describe('buildDeck', () => {
  it('builds the classic 108-card deck by default', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
  });

  it('has the correct color/number distribution', () => {
    const deck = buildDeck();
    const numberCards = deck.filter((c) => c.type.kind === 'number');
    expect(numberCards).toHaveLength(76); // 4 colors * (1 zero + 2*9 others)

    for (const color of ['red', 'yellow', 'green', 'blue'] as const) {
      const zeroes = numberCards.filter((c) => c.color === color && c.type.kind === 'number' && c.type.value === 0);
      expect(zeroes).toHaveLength(1);
      const ones = numberCards.filter((c) => c.color === color && c.type.kind === 'number' && c.type.value === 1);
      expect(ones).toHaveLength(2);

      expect(deck.filter((c) => c.color === color && c.type.kind === 'skip')).toHaveLength(2);
      expect(deck.filter((c) => c.color === color && c.type.kind === 'reverse')).toHaveLength(2);
      expect(deck.filter((c) => c.color === color && c.type.kind === 'draw_two')).toHaveLength(2);
    }

    expect(deck.filter((c) => c.type.kind === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.type.kind === 'wild_draw_four')).toHaveLength(4);
  });

  it('assigns every card a unique id', () => {
    const deck = buildDeck();
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });

  it('builds the 112-card variant with a Swap Hands card and customizable cards', () => {
    const deck = buildDeck({ includeSwapOrShuffle: 'swap', customizableCount: 3 });
    expect(deck).toHaveLength(112);
    expect(deck.filter((c) => c.type.kind === 'wild_swap_hands')).toHaveLength(1);
    expect(deck.filter((c) => c.type.kind === 'wild_shuffle_hands')).toHaveLength(0);
    expect(deck.filter((c) => c.type.kind === 'wild_customizable')).toHaveLength(3);
  });

  it('builds the 112-card variant with Shuffle Hands instead of Swap Hands', () => {
    const deck = buildDeck({ includeSwapOrShuffle: 'shuffle', customizableCount: 3 });
    expect(deck.filter((c) => c.type.kind === 'wild_shuffle_hands')).toHaveLength(1);
    expect(deck.filter((c) => c.type.kind === 'wild_swap_hands')).toHaveLength(0);
  });
});

describe('shuffle', () => {
  it('returns a permutation of the same items without mutating the input', () => {
    const original = buildDeck();
    const copy = [...original];
    const shuffled = shuffle(original);

    expect(original).toEqual(copy); // input untouched
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...original].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});
