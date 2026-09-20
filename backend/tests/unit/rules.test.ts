import { describe, it, expect, beforeEach } from 'vitest';
import type { Card, Color } from '@uno/shared';
import type { GameState } from '../../src/game/types';
import {
  callUno,
  catchUno,
  challengeWildDrawFour,
  drawCard,
  isLegalPlay,
  passTurn,
  playCard,
} from '../../src/game/rules';

function c(color: Color, type: Card['type'], id: string): Card {
  return { id, color, type };
}

function fillerCards(n: number, prefix = 'filler'): Card[] {
  return Array.from({ length: n }, (_, i) => c('red', { kind: 'number', value: 5 }, `${prefix}-${i}`));
}

function baseGame(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'ROOM01',
    version: 0,
    roundNumber: 1,
    deck: fillerCards(20),
    discardPile: [c('red', { kind: 'number', value: 5 }, 'top')],
    hands: {
      p1: [c('red', { kind: 'number', value: 7 }, 'p1-a')],
      p2: [c('blue', { kind: 'number', value: 3 }, 'p2-a')],
      p3: [c('green', { kind: 'number', value: 9 }, 'p3-a')],
    },
    activeColor: 'red',
    turnOrder: ['p1', 'p2', 'p3'],
    turnIndex: 0,
    direction: 1,
    pendingUnoCall: null,
    pendingChallenge: null,
    pendingDrawDecision: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('isLegalPlay', () => {
  const top = c('red', { kind: 'number', value: 5 }, 'top');

  it('matches by color', () => {
    expect(isLegalPlay(c('red', { kind: 'number', value: 9 }, 'x'), top, 'red')).toBe(true);
  });

  it('matches by number regardless of color', () => {
    expect(isLegalPlay(c('blue', { kind: 'number', value: 5 }, 'x'), top, 'red')).toBe(true);
  });

  it('matches by symbol regardless of color', () => {
    const topSkip = c('red', { kind: 'skip' }, 'top-skip');
    expect(isLegalPlay(c('blue', { kind: 'skip' }, 'x'), topSkip, 'red')).toBe(true);
  });

  it('wild is always legal', () => {
    expect(isLegalPlay(c('wild', { kind: 'wild' }, 'x'), top, 'red')).toBe(true);
    expect(isLegalPlay(c('wild', { kind: 'wild_draw_four' }, 'x'), top, 'red')).toBe(true);
  });

  it('rejects a non-matching, non-wild card', () => {
    expect(isLegalPlay(c('blue', { kind: 'number', value: 2 }, 'x'), top, 'red')).toBe(false);
  });
});

describe('playCard', () => {
  it('rejects a play out of turn', () => {
    const game = baseGame();
    expect(() => playCard(game, { playerId: 'p2', cardId: 'p2-a' })).toThrow(/not your turn/i);
  });

  it('rejects an illegal card', () => {
    const game = baseGame({ hands: { p1: [c('blue', { kind: 'number', value: 2 }, 'p1-a')], p2: [], p3: [] } });
    expect(() => playCard(game, { playerId: 'p1', cardId: 'p1-a' })).toThrow(/illegal play/i);
  });

  it('Skip advances the turn by two players', () => {
    const game = baseGame({
      hands: {
        p1: [c('red', { kind: 'skip' }, 'p1-a'), c('red', { kind: 'number', value: 9 }, 'p1-extra')],
        p2: [c('blue', { kind: 'number', value: 1 }, 'p2-a')],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.turnIndex).toBe(2); // p3, skipping p2
  });

  it('Reverse flips direction and advances one step', () => {
    const game = baseGame({
      hands: {
        p1: [c('red', { kind: 'reverse' }, 'p1-a'), c('red', { kind: 'number', value: 9 }, 'p1-extra')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.direction).toBe(-1);
    expect(game.turnIndex).toBe(2); // one step backward from 0 wraps to last seat
  });

  it('Draw Two forces the next player to draw 2 and skips them', () => {
    const game = baseGame({
      hands: {
        p1: [c('red', { kind: 'draw_two' }, 'p1-a'), c('red', { kind: 'number', value: 9 }, 'p1-extra')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.hands.p2).toHaveLength(2);
    expect(game.turnIndex).toBe(2); // p3, skipping p2
  });

  it('Wild requires a chosen color and sets it as active', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild' }, 'p1-a'), c('red', { kind: 'number', value: 9 }, 'p1-extra')],
        p2: [],
        p3: [],
      },
    });
    expect(() => playCard(game, { playerId: 'p1', cardId: 'p1-a' })).toThrow(/color/i);
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.activeColor).toBe('blue');
    expect(game.turnIndex).toBe(1);
  });

  it('ends the round when the player empties their hand', () => {
    const game = baseGame({
      hands: { p1: [c('red', { kind: 'number', value: 5 }, 'p1-a')], p2: [c('blue', { kind: 'number', value: 3 }, 'p2-a')], p3: [] },
    });
    const events = playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(events).toContainEqual({ type: 'round_ended', winnerId: 'p1' });
    expect(game.hands.p1).toHaveLength(0);
  });

  it('sets pendingUnoCall when a player is left with one card', () => {
    const game = baseGame({
      hands: {
        p1: [c('red', { kind: 'number', value: 5 }, 'p1-a'), c('red', { kind: 'number', value: 6 }, 'p1-b')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.pendingUnoCall).toEqual({ playerId: 'p1' });
  });
});

describe('Wild Draw Four challenge', () => {
  it('records hadLegalAlternative=true when the player had a matching-color card', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a'), c('red', { kind: 'number', value: 2 }, 'p1-b')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.pendingChallenge?.hadLegalAlternative).toBe(true);
    expect(game.hands.p2).toHaveLength(4); // optimistic draw applied
  });

  it('a successful challenge (guilty) makes the original player draw 4 and restores the target turn', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a'), c('red', { kind: 'number', value: 2 }, 'p1-b')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.turnIndex).toBe(2); // p2 skipped

    challengeWildDrawFour(game, 'p2');
    expect(game.hands.p2).toHaveLength(0); // draw undone
    expect(game.hands.p1).toHaveLength(1 + 4); // remaining card + 4 penalty
    expect(game.turnIndex).toBe(1); // p2's turn restored
    expect(game.pendingChallenge).toBeNull();
  });

  it('a failed challenge (not guilty) makes the challenger draw 6 total and stay skipped', () => {
    const game = baseGame({
      hands: {
        // blue extra: not a "red" alternative, so this is a legal (non-guilty) WD4 play
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a'), c('blue', { kind: 'number', value: 9 }, 'p1-extra')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.pendingChallenge?.hadLegalAlternative).toBe(false);

    challengeWildDrawFour(game, 'p2');
    expect(game.hands.p2).toHaveLength(6);
    expect(game.turnIndex).toBe(2); // stays skipped
  });
});

describe('draw / pass', () => {
  it('does not advance the turn when the drawn card is playable, until passed', () => {
    const game = baseGame({
      deck: [c('red', { kind: 'number', value: 1 }, 'drawn')],
      hands: { p1: [c('blue', { kind: 'number', value: 2 }, 'p1-a')], p2: [], p3: [] },
    });
    const { drawn } = drawCard(game, 'p1');
    expect(drawn?.id).toBe('drawn');
    expect(game.turnIndex).toBe(0);
    expect(game.pendingDrawDecision).toEqual({ playerId: 'p1', cardId: 'drawn' });

    passTurn(game, 'p1');
    expect(game.turnIndex).toBe(1);
    expect(game.pendingDrawDecision).toBeNull();
  });

  it('advances the turn immediately when the drawn card is not playable', () => {
    const game = baseGame({
      deck: [c('blue', { kind: 'number', value: 2 }, 'drawn')],
      hands: { p1: [], p2: [], p3: [] },
    });
    drawCard(game, 'p1');
    expect(game.turnIndex).toBe(1);
    expect(game.pendingDrawDecision).toBeNull();
  });

  it('only allows playing the just-drawn card, not another hand card', () => {
    const game = baseGame({
      deck: [c('red', { kind: 'number', value: 1 }, 'drawn')],
      hands: { p1: [c('red', { kind: 'number', value: 9 }, 'p1-old')], p2: [], p3: [] },
    });
    drawCard(game, 'p1');
    expect(() => playCard(game, { playerId: 'p1', cardId: 'p1-old' })).toThrow(/must play the card you just drew/i);
    expect(() => playCard(game, { playerId: 'p1', cardId: 'drawn' })).not.toThrow();
  });
});

describe('2-player house rules (User Story 4)', () => {
  function twoPlayerGame(overrides: Partial<GameState> = {}): GameState {
    return baseGame({
      turnOrder: ['p1', 'p2'],
      hands: { p1: [], p2: [] },
      ...overrides,
    });
  }

  it('without the house rule, Reverse just passes to the other player', () => {
    const game = twoPlayerGame({
      hands: { p1: [c('red', { kind: 'reverse' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')], p2: [] },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.turnIndex).toBe(1); // p2 — no house rule, so it's a plain pass
  });

  it('with the house rule, Reverse acts as Skip and returns the turn to the same player', () => {
    const game = twoPlayerGame({
      hands: { p1: [c('red', { kind: 'reverse' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')], p2: [] },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' }, { twoPlayerReverseIsSkip: true });
    expect(game.turnIndex).toBe(0); // back to p1
  });

  it('the house rule has no effect with 3+ players', () => {
    const game = baseGame({
      hands: { p1: [c('red', { kind: 'reverse' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')], p2: [], p3: [] },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' }, { twoPlayerReverseIsSkip: true });
    expect(game.direction).toBe(-1);
    expect(game.turnIndex).toBe(2); // one step backward, same as the non-house-rule case
  });

  it('Draw Two already resumes back to the player who played it with exactly 2 players', () => {
    const game = twoPlayerGame({
      hands: { p1: [c('red', { kind: 'draw_two' }, 'p1-a')], p2: [] },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.hands.p2).toHaveLength(2);
    expect(game.turnIndex).toBe(0); // back to p1 — falls out of the normal skip-by-2 math
  });
});

describe('Wild Swap Hands / Wild Shuffle Hands (User Story 4)', () => {
  it('swaps hands with the chosen player', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_swap_hands' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')],
        p2: [c('blue', { kind: 'number', value: 7 }, 'p2-a'), c('green', { kind: 'number', value: 8 }, 'p2-b')],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue', targetPlayerId: 'p2' });
    expect(game.hands.p1.map((c) => c.id)).toEqual(['p2-a', 'p2-b']);
    expect(game.hands.p2.map((c) => c.id)).toEqual(['p1-b']);
  });

  it('rejects a missing or self target', () => {
    const game = baseGame({
      hands: { p1: [c('wild', { kind: 'wild_swap_hands' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')], p2: [], p3: [] },
    });
    expect(() => playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' })).toThrow(/choose a player/i);
  });

  it('does not swap when it is the winning last card', () => {
    const game = baseGame({
      hands: { p1: [c('wild', { kind: 'wild_swap_hands' }, 'p1-a')], p2: [c('blue', { kind: 'number', value: 7 }, 'p2-a')], p3: [] },
    });
    const events = playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue', targetPlayerId: 'p2' });
    expect(events).toContainEqual({ type: 'round_ended', winnerId: 'p1' });
    expect(game.hands.p2.map((c) => c.id)).toEqual(['p2-a']); // untouched
  });

  it('redeals all cards starting with the player to the left', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_shuffle_hands' }, 'p1-a'), c('red', { kind: 'number', value: 9 }, 'p1-b')],
        p2: [c('blue', { kind: 'number', value: 1 }, 'p2-a')],
        p3: [c('green', { kind: 'number', value: 2 }, 'p3-a'), c('green', { kind: 'number', value: 3 }, 'p3-b')],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    const totalAfter = game.hands.p1.length + game.hands.p2.length + game.hands.p3.length;
    expect(totalAfter).toBe(4); // p1-b, p2-a, p3-a, p3-b redistributed — nothing lost or duplicated
    expect(game.turnIndex).toBe(1);
  });
});

describe('Uno call / catch', () => {
  let game: GameState;

  beforeEach(() => {
    game = baseGame({
      hands: { p1: [c('red', { kind: 'number', value: 5 }, 'p1-only')], p2: [], p3: [] },
      pendingUnoCall: { playerId: 'p1' },
    });
  });

  it('callUno clears the pending flag when the caller has one card', () => {
    callUno(game, 'p1');
    expect(game.pendingUnoCall).toBeNull();
  });

  it('rejects callUno when the player does not have exactly one card', () => {
    game.hands.p1.push(c('red', { kind: 'number', value: 1 }, 'p1-extra'));
    expect(() => callUno(game, 'p1')).toThrow(/exactly one card/i);
  });

  it('catchUno penalizes a player who has not declared', () => {
    catchUno(game, 'p1');
    expect(game.hands.p1).toHaveLength(3); // 1 + 2 penalty
    expect(game.pendingUnoCall).toBeNull();
  });

  it('catchUno fails once the player has already declared', () => {
    callUno(game, 'p1');
    expect(() => catchUno(game, 'p1')).toThrow(/already declared/i);
  });
});
