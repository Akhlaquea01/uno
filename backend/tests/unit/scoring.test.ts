import { describe, it, expect } from 'vitest';
import type { Card } from '@uno/shared';
import { cardPointValue, computeRoundScore, handValue } from '../../src/game/scoring';

function c(color: Card['color'], type: Card['type']): Card {
  return { id: Math.random().toString(36), color, type };
}

describe('cardPointValue', () => {
  it('scores number cards at face value', () => {
    expect(cardPointValue(c('red', { kind: 'number', value: 7 }))).toBe(7);
    expect(cardPointValue(c('red', { kind: 'number', value: 0 }))).toBe(0);
  });

  it('scores Skip/Reverse/Draw Two at 20', () => {
    expect(cardPointValue(c('red', { kind: 'skip' }))).toBe(20);
    expect(cardPointValue(c('red', { kind: 'reverse' }))).toBe(20);
    expect(cardPointValue(c('red', { kind: 'draw_two' }))).toBe(20);
  });

  it('scores Wild/Wild Draw Four at 50', () => {
    expect(cardPointValue(c('wild', { kind: 'wild' }))).toBe(50);
    expect(cardPointValue(c('wild', { kind: 'wild_draw_four' }))).toBe(50);
  });

  it('scores Swap/Shuffle/Customizable at 40', () => {
    expect(cardPointValue(c('wild', { kind: 'wild_swap_hands' }))).toBe(40);
    expect(cardPointValue(c('wild', { kind: 'wild_shuffle_hands' }))).toBe(40);
    expect(cardPointValue(c('wild', { kind: 'wild_customizable', text: '' }))).toBe(40);
  });
});

describe('computeRoundScore', () => {
  it('awards the winner the sum of every other hand, and zero for the winner', () => {
    const hands: Record<string, Card[]> = {
      winner: [],
      p2: [c('red', { kind: 'number', value: 7 }), c('blue', { kind: 'skip' })],
      p3: [c('wild', { kind: 'wild_draw_four' })],
    };
    const result = computeRoundScore(hands, 'winner');
    expect(result.perPlayerCardsLeftValue).toEqual({ winner: 0, p2: 27, p3: 50 });
    expect(result.pointsAwardedToWinner).toBe(77);
  });

  it('handValue sums a hand correctly', () => {
    expect(handValue([c('red', { kind: 'number', value: 3 }), c('red', { kind: 'number', value: 4 })])).toBe(7);
  });
});
