import { describe, it, expect } from 'vitest';
import type { Card } from '@uno/shared';
import type { PlayerState } from '../../src/game/types';
import { chooseStartColor, setupGame } from '../../src/game/rules';

const players: PlayerState[] = [
  { id: 'p1', userId: 'u1', displayName: 'A', socketId: null, connectionStatus: 'connected', seat: 0, isHost: true, matchScore: 0 },
  { id: 'p2', userId: 'u2', displayName: 'B', socketId: null, connectionStatus: 'connected', seat: 1, isHost: false, matchScore: 0 },
  { id: 'p3', userId: 'u3', displayName: 'C', socketId: null, connectionStatus: 'connected', seat: 2, isHost: false, matchScore: 0 },
];

function fillerCards(n: number, prefix: string): Card[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, color: 'blue', type: { kind: 'number', value: 4 } }) as Card);
}

/** Builds a deck (in pop-order) that deals 21 filler hand cards, then flips `flipCard`, then `extra`. */
function deckForFlip(flipCard: Card, extra: Card[] = []): Card[] {
  const popOrder = [...fillerCards(21, 'hand'), flipCard, ...extra, ...fillerCards(30, 'rest')];
  return [...popOrder].reverse();
}

describe('setupGame first-card rules', () => {
  it('deals 7 cards to each player', () => {
    const { game } = setupGame('ROOM01', players, {}, deckForFlip({ id: 'flip', color: 'red', type: { kind: 'number', value: 5 } }));
    expect(game.hands.p1).toHaveLength(7);
    expect(game.hands.p2).toHaveLength(7);
    expect(game.hands.p3).toHaveLength(7);
  });

  it('a number card start: turn 0, direction 1, active color from the card', () => {
    const { game } = setupGame('ROOM01', players, {}, deckForFlip({ id: 'flip', color: 'green', type: { kind: 'number', value: 5 } }));
    expect(game.turnIndex).toBe(0);
    expect(game.direction).toBe(1);
    expect(game.activeColor).toBe('green');
  });

  it('Skip flipped first: the first player loses their turn', () => {
    const { game } = setupGame('ROOM01', players, {}, deckForFlip({ id: 'flip', color: 'red', type: { kind: 'skip' } }));
    expect(game.turnIndex).toBe(1); // p2 starts instead of p1
  });

  it('Reverse flipped first: direction flips and the last seat starts', () => {
    const { game } = setupGame('ROOM01', players, {}, deckForFlip({ id: 'flip', color: 'red', type: { kind: 'reverse' } }));
    expect(game.direction).toBe(-1);
    expect(game.turnIndex).toBe(2);
  });

  it('Draw Two flipped first: the first player draws 2 and is skipped', () => {
    const { game, events } = setupGame('ROOM01', players, {}, deckForFlip({ id: 'flip', color: 'red', type: { kind: 'draw_two' } }));
    expect(game.hands.p1).toHaveLength(9); // 7 + 2 penalty
    expect(game.turnIndex).toBe(1);
    expect(events).toContainEqual({ type: 'penalty_draw', playerId: 'p1', count: 2, reason: 'draw_two' });
  });

  it('Wild flipped first: color stays unset until the first player chooses', () => {
    const { game } = setupGame('ROOM01', players, {}, deckForFlip({ id: 'flip', color: 'wild', type: { kind: 'wild' } }));
    expect(game.activeColor).toBe('wild');
    expect(game.turnIndex).toBe(0);

    chooseStartColor(game, 'p1', 'green');
    expect(game.activeColor).toBe('green');
  });

  it('Wild Draw Four flipped first: it is reshuffled back and a new card is flipped', () => {
    const wd4: Card = { id: 'wd4-flip', color: 'wild', type: { kind: 'wild_draw_four' } };
    const realFlip: Card = { id: 'real-flip', color: 'blue', type: { kind: 'number', value: 3 } };
    const { game } = setupGame('ROOM01', players, {}, deckForFlip(wd4, [realFlip]));

    expect(game.discardPile[0].type.kind).not.toBe('wild_draw_four');
    // The reshuffle randomizes order, so just assert the WD4 ended up back in the deck, not discarded.
    expect(game.deck.some((c) => c.id === 'wd4-flip')).toBe(true);
  });
});
