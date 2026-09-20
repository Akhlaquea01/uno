import { describe, it, expect, beforeEach } from 'vitest';
import type { Card, Color } from '@uno/shared';
import type { GameState } from '../../src/game/types';
import {
  callUno,
  catchUno,
  challengeWildDrawFour,
  declineChallenge,
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

  it('rejects targeting a teammate in Team Mode', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_swap_hands' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')],
        p2: [c('blue', { kind: 'number', value: 7 }, 'p2-a')],
        p3: [c('green', { kind: 'number', value: 8 }, 'p3-a')],
      },
    });
    const teamOf = { p1: 0, p2: 0, p3: 1 } as const;
    expect(() =>
      playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue', targetPlayerId: 'p2' }, { teamOf }),
    ).toThrow(/opposing player/i);
    // The rejection happens before any hand is exchanged.
    expect(game.hands.p2.map((c) => c.id)).toEqual(['p2-a']);
  });

  it('allows swapping with an opposing player in Team Mode', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_swap_hands' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')],
        p2: [c('blue', { kind: 'number', value: 7 }, 'p2-a')],
        p3: [c('green', { kind: 'number', value: 8 }, 'p3-a')],
      },
    });
    const teamOf = { p1: 0, p2: 0, p3: 1 } as const;
    expect(() =>
      playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue', targetPlayerId: 'p3' }, { teamOf }),
    ).not.toThrow();
    expect(game.hands.p1.map((c) => c.id)).toEqual(['p3-a']);
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

describe('declineChallenge', () => {
  it('clears the pending challenge with no extra penalty when the target accepts', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a'), c('red', { kind: 'number', value: 2 }, 'p1-b')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.pendingChallenge).not.toBeNull();
    expect(game.hands.p2).toHaveLength(4); // optimistic draw already applied

    declineChallenge(game, 'p2');
    expect(game.pendingChallenge).toBeNull();
    expect(game.hands.p2).toHaveLength(4); // no extra penalty, just accepted
    expect(game.turnIndex).toBe(2); // turn stays where the WD4 already left it
  });

  it('rejects decline from anyone other than the target', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a'), c('red', { kind: 'number', value: 2 }, 'p1-b')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(() => declineChallenge(game, 'p3')).toThrow(/only the player who drew/i);
  });

  it('rejects decline when there is nothing pending', () => {
    const game = baseGame();
    expect(() => declineChallenge(game, 'p1')).toThrow(/no wild draw four to challenge/i);
  });
});

describe('Wild Draw Four challenge legality after a chained Wild (color exploit fix)', () => {
  it("checks the true prior color, not the WD4 player's own new pick", () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild' }, 'p1-a'), c('red', { kind: 'number', value: 4 }, 'p1-filler')],
        p2: [c('wild', { kind: 'wild_draw_four' }, 'p2-a'), c('blue', { kind: 'number', value: 7 }, 'p2-b')],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.turnIndex).toBe(1); // p2's turn
    expect(game.discardPile[game.discardPile.length - 1].color).toBe('wild');

    playCard(game, { playerId: 'p2', cardId: 'p2-a', chosenColor: 'green' });
    // p2 held a legal blue alternative under the true prior color (blue), even
    // though p2 picked 'green' for their own WD4 — must still be ruled guilty.
    expect(game.pendingChallenge?.hadLegalAlternative).toBe(true);
  });
});

describe('Wild Draw Four as a winning last card', () => {
  it('still applies the draw-4 penalty but does not open a challenge', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a')], // last card
        p2: [c('blue', { kind: 'number', value: 3 }, 'p2-a')],
        p3: [],
      },
    });
    const events = playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(events).toContainEqual({ type: 'round_ended', winnerId: 'p1' });
    expect(game.hands.p2).toHaveLength(5); // 1 + 4 penalty still applied
    expect(game.pendingChallenge).toBeNull(); // nothing left to challenge
    expect(events.some((e) => e.type === 'challenge_opened')).toBe(false);
  });
});

describe('Wild Draw Four challenge-loss draw shuffling', () => {
  it('conserves every card (none lost or duplicated) when the returned draw is reshuffled back in', () => {
    const game = baseGame({
      deck: fillerCards(10, 'deck'),
      hands: {
        p1: [c('wild', { kind: 'wild_draw_four' }, 'p1-a'), c('red', { kind: 'number', value: 2 }, 'p1-b')],
        p2: [],
        p3: [],
      },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    challengeWildDrawFour(game, 'p2'); // p1 had a legal alternative -> guilty, draws 4 back

    const allIdsAfter = [
      ...game.deck,
      ...game.discardPile,
      ...Object.values(game.hands).flat(),
    ].map((card) => card.id);
    expect(new Set(allIdsAfter).size).toBe(allIdsAfter.length); // no duplicates
    expect(allIdsAfter).toHaveLength(2 /* p1's cards */ + 10 /* filler deck */ + 1 /* initial discard top */);
  });
});

describe('pendingUnoCall stays in sync with actual hand sizes', () => {
  it('updates when a Draw Two penalty lands on an already-one-card hand', () => {
    const game = baseGame({
      turnOrder: ['p1', 'p2'],
      hands: {
        p1: [c('red', { kind: 'draw_two' }, 'p1-a')],
        p2: [c('blue', { kind: 'number', value: 1 }, 'p2-only')],
      },
      pendingUnoCall: { playerId: 'p2' },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a' });
    expect(game.hands.p2).toHaveLength(3); // 1 + 2 penalty
    expect(game.pendingUnoCall).toBeNull(); // no longer at exactly one card
  });

  it('follows the hand through Wild Swap Hands, not the player', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_swap_hands' }, 'p1-a'), c('red', { kind: 'number', value: 1 }, 'p1-b')],
        p2: [c('blue', { kind: 'number', value: 7 }, 'p2-a'), c('green', { kind: 'number', value: 8 }, 'p2-b')],
        p3: [],
      },
      pendingUnoCall: null, // nobody is at one card before the swap
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue', targetPlayerId: 'p2' });
    expect(game.hands.p1).toHaveLength(2); // p1 now holds p2's old 2-card hand
    expect(game.hands.p2).toHaveLength(1); // p2 now holds p1's old 1-card leftover
    // p2 received a one-card hand via the swap — pendingUnoCall must pick that
    // up even though p2 was never at one card through any play of their own.
    expect(game.pendingUnoCall).toEqual({ playerId: 'p2' });
  });

  it('reflects reality after Wild Shuffle Hands, whoever ends up at one card', () => {
    const game = baseGame({
      hands: {
        p1: [c('wild', { kind: 'wild_shuffle_hands' }, 'p1-a'), c('red', { kind: 'number', value: 9 }, 'p1-b')],
        p2: [c('blue', { kind: 'number', value: 1 }, 'p2-only')],
        p3: [c('green', { kind: 'number', value: 2 }, 'p3-a'), c('green', { kind: 'number', value: 3 }, 'p3-b')],
      },
      pendingUnoCall: { playerId: 'p2' },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    const counts: Record<string, number> = {
      p1: game.hands.p1.length,
      p2: game.hands.p2.length,
      p3: game.hands.p3.length,
    };
    if (game.pendingUnoCall) {
      expect(counts[game.pendingUnoCall.playerId]).toBe(1);
    } else {
      expect(Object.values(counts)).not.toContain(1);
    }
  });

  it('is restored for the target when a successful challenge undoes their draw', () => {
    const game = baseGame({
      hands: {
        // p1 keeps two spare cards so p1 itself doesn't also land on one card
        // and contend for the single pendingUnoCall slot below.
        p1: [
          c('wild', { kind: 'wild_draw_four' }, 'p1-a'),
          c('red', { kind: 'number', value: 2 }, 'p1-b'),
          c('red', { kind: 'number', value: 3 }, 'p1-c'),
        ],
        p2: [c('blue', { kind: 'number', value: 9 }, 'p2-only')], // already at one card
        p3: [],
      },
      pendingUnoCall: { playerId: 'p2' },
    });
    playCard(game, { playerId: 'p1', cardId: 'p1-a', chosenColor: 'blue' });
    expect(game.hands.p2).toHaveLength(5); // 1 + 4 optimistic draw
    expect(game.pendingUnoCall).toBeNull(); // no longer at one card

    challengeWildDrawFour(game, 'p2'); // p1 had a legal alternative -> guilty
    expect(game.hands.p2).toHaveLength(1); // draw undone, back to their original card
    expect(game.pendingUnoCall).toEqual({ playerId: 'p2' });
  });
});
