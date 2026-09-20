import type { Card, Color } from '@uno/shared';
import { buildDeck, shuffle } from './deck';
import {
  IllegalActionError,
  type DeckOptions,
  type EngineEvent,
  type GameState,
  type PlayerState,
} from './types';

const REAL_COLORS: Exclude<Color, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

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

function isWild(card: Card): boolean {
  return card.color === 'wild';
}

/** "No other alternative cards matching the color previously played" (Wild Draw Four legality). */
function hasLegalAlternative(hand: Card[], excludeCardId: string, activeColor: Color): boolean {
  return hand.some((c) => c.id !== excludeCardId && c.color === activeColor);
}

function nextIndex(current: number, direction: 1 | -1, playerCount: number, steps = 1): number {
  let idx = current;
  for (let i = 0; i < steps; i++) {
    idx = (idx + direction + playerCount) % playerCount;
  }
  return idx;
}

export function reshuffleIfNeeded(game: GameState): void {
  if (game.deck.length > 0) return;
  const top = game.discardPile[game.discardPile.length - 1];
  const rest = game.discardPile.slice(0, -1);
  if (rest.length === 0) return; // nothing to reshuffle from yet
  game.deck = shuffle(rest);
  game.discardPile = top ? [top] : [];
}

export function drawCards(game: GameState, playerId: string, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    reshuffleIfNeeded(game);
    const card = game.deck.pop();
    if (!card) break; // both piles exhausted (edge case, deck genuinely empty)
    drawn.push(card);
  }
  game.hands[playerId] = [...(game.hands[playerId] ?? []), ...drawn];
  return drawn;
}

export interface SetupResult {
  game: GameState;
  events: EngineEvent[];
}

/**
 * Deals 7 cards to each seated player and seeds the discard pile, applying
 * the "first card is an Action/Wild/Wild-Draw-Four" rules (FR-004).
 */
export function setupGame(
  roomCode: string,
  players: PlayerState[],
  deckOptions: DeckOptions = {},
  /** Test-only seam: inject a pre-ordered deck (drawn from the end) instead of a fresh shuffle. */
  deckOverride?: Card[],
): SetupResult {
  const seated = [...players].sort((a, b) => a.seat - b.seat);
  const turnOrder = seated.map((p) => p.id);
  const events: EngineEvent[] = [];

  let deck = deckOverride ? [...deckOverride] : shuffle(buildDeck(deckOptions));
  const hands: Record<string, Card[]> = {};
  for (const id of turnOrder) hands[id] = [];
  for (let i = 0; i < 7; i++) {
    for (const id of turnOrder) {
      const card = deck.pop();
      if (card) hands[id].push(card);
    }
  }

  // Wild Draw Four turned up first: return it, reshuffle, redraw (bounded to avoid
  // an infinite loop in a pathological all-WD4 remainder, which cannot happen with
  // a real 108/112-card deck).
  let flipped: Card | undefined;
  for (let attempt = 0; attempt < deck.length + 1; attempt++) {
    const candidate = deck.pop();
    if (!candidate) break;
    if (candidate.type.kind === 'wild_draw_four') {
      deck = shuffle([...deck, candidate]);
      continue;
    }
    flipped = candidate;
    break;
  }
  if (!flipped) {
    throw new IllegalActionError('setup_failed', 'Could not seed a starting discard card.');
  }

  const game: GameState = {
    roomCode,
    version: 0,
    roundNumber: 1,
    deck,
    discardPile: [flipped],
    hands,
    activeColor: flipped.color !== 'wild' ? flipped.color : 'wild',
    turnOrder,
    turnIndex: 0,
    direction: 1,
    pendingUnoCall: null,
    pendingChallenge: null,
    pendingDrawDecision: null,
    updatedAt: new Date(),
  };

  applyFirstCardRules(game, flipped, events);
  return { game, events };
}

function applyFirstCardRules(game: GameState, flipped: Card, events: EngineEvent[]): void {
  const count = game.turnOrder.length;
  switch (flipped.type.kind) {
    case 'skip':
      game.turnIndex = nextIndex(0, 1, count, 1);
      break;
    case 'reverse':
      game.direction = -1;
      game.turnIndex = count - 1; // "dealer" analog goes first (see research.md setup notes)
      break;
    case 'draw_two': {
      const firstPlayerId = game.turnOrder[0];
      drawCards(game, firstPlayerId, 2);
      events.push({ type: 'penalty_draw', playerId: firstPlayerId, count: 2, reason: 'draw_two' });
      game.turnIndex = nextIndex(0, 1, count, 1);
      break;
    }
    case 'wild':
    case 'wild_swap_hands':
    case 'wild_shuffle_hands':
    case 'wild_customizable':
      // activeColor stays 'wild' until the first player chooses (chooseStartColor).
      game.turnIndex = 0;
      break;
    default:
      game.turnIndex = 0;
  }
}

export function chooseStartColor(game: GameState, playerId: string, color: Exclude<Color, 'wild'>): void {
  if (game.activeColor !== 'wild') {
    throw new IllegalActionError('no_color_choice_pending', 'The starting color is already set.');
  }
  if (game.turnOrder[game.turnIndex] !== playerId) {
    throw new IllegalActionError('not_your_turn', 'Only the starting player chooses the color.');
  }
  game.activeColor = color;
}

function advanceTurn(game: GameState, steps = 1): void {
  game.turnIndex = nextIndex(game.turnIndex, game.direction, game.turnOrder.length, steps);
}

function afterHandChange(game: GameState, playerId: string, events: EngineEvent[]): boolean {
  const count = game.hands[playerId]?.length ?? 0;
  if (count === 0) {
    events.push({ type: 'round_ended', winnerId: playerId });
    return true;
  }
  if (count === 1) {
    game.pendingUnoCall = { playerId };
  } else if (game.pendingUnoCall?.playerId === playerId) {
    game.pendingUnoCall = null;
  }
  return false;
}

export interface PlayCardInput {
  playerId: string;
  cardId: string;
  chosenColor?: Color;
  /** Required when playing a Wild Swap Hands card (User Story 4). */
  targetPlayerId?: string;
}

export interface HouseRuleOptions {
  /** "For two players: Reverse works like Skip" — only meaningful with exactly 2 players. */
  twoPlayerReverseIsSkip?: boolean;
}

export function playCard(game: GameState, input: PlayCardInput, houseRules: HouseRuleOptions = {}): EngineEvent[] {
  const events: EngineEvent[] = [];
  const { playerId, cardId } = input;

  if (game.activeColor === 'wild') {
    throw new IllegalActionError('color_choice_pending', 'Waiting for the starting color to be chosen.');
  }
  if (game.turnOrder[game.turnIndex] !== playerId) {
    throw new IllegalActionError('not_your_turn', 'It is not your turn.');
  }
  if (game.pendingChallenge) {
    throw new IllegalActionError('challenge_pending', 'Resolve the Wild Draw Four challenge first.');
  }
  if (game.pendingDrawDecision && game.pendingDrawDecision.playerId === playerId) {
    if (game.pendingDrawDecision.cardId !== cardId) {
      throw new IllegalActionError(
        'must_play_drawn_card',
        'You must play the card you just drew, or pass.',
      );
    }
  }

  const hand = game.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new IllegalActionError('card_not_in_hand', 'You do not hold that card.');

  const topCard = game.discardPile[game.discardPile.length - 1];
  if (!isLegalPlay(card, topCard, game.activeColor)) {
    throw new IllegalActionError('illegal_play', 'That is an illegal play: it does not match the discard pile.');
  }

  const isWildCard = isWild(card);
  if (isWildCard && !input.chosenColor) {
    throw new IllegalActionError('color_required', 'Choose a color to continue play.');
  }
  if (input.chosenColor && !REAL_COLORS.includes(input.chosenColor as Exclude<Color, 'wild'>)) {
    throw new IllegalActionError('invalid_color', 'Chosen color must be red, yellow, green, or blue.');
  }

  // Move the card.
  game.hands[playerId] = hand.filter((c) => c.id !== cardId);
  game.discardPile.push(card);
  game.pendingDrawDecision = null;
  game.activeColor = isWildCard ? (input.chosenColor as Exclude<Color, 'wild'>) : card.color;

  // Even a winning last card still applies its effect (e.g. the next player must
  // draw, which counts against their score) — only turn advancement is skipped
  // once the round is over, since there's no next turn to take.
  const won = afterHandChange(game, playerId, events);

  switch (card.type.kind) {
    case 'skip':
      if (!won) advanceTurn(game, 2);
      break;
    case 'reverse': {
      game.direction = game.direction === 1 ? -1 : 1;
      const twoPlayerSkip = houseRules.twoPlayerReverseIsSkip && game.turnOrder.length === 2;
      if (!won) advanceTurn(game, twoPlayerSkip ? 2 : 1);
      break;
    }
    case 'draw_two': {
      const targetId = game.turnOrder[nextIndex(game.turnIndex, game.direction, game.turnOrder.length, 1)];
      const drawn = drawCards(game, targetId, 2);
      events.push({ type: 'penalty_draw', playerId: targetId, count: drawn.length, reason: 'draw_two' });
      if (!won) advanceTurn(game, 2);
      break;
    }
    case 'wild_draw_four': {
      const targetId = game.turnOrder[nextIndex(game.turnIndex, game.direction, game.turnOrder.length, 1)];
      const hadAlternative = hasLegalAlternative(hand, cardId, topCard.color !== 'wild' ? topCard.color : game.activeColor);
      const drawnCards = drawCards(game, targetId, 4);
      game.pendingChallenge = {
        playerId,
        hadLegalAlternative: hadAlternative,
        targetPlayerId: targetId,
        drawnCardIds: drawnCards.map((c) => c.id),
      };
      events.push({ type: 'challenge_opened', byPlayerId: playerId });
      events.push({ type: 'penalty_draw', playerId: targetId, count: drawnCards.length, reason: 'wild_draw_four' });
      if (!won) advanceTurn(game, 2);
      break;
    }
    case 'wild_swap_hands': {
      // Per the rules doc: if this was your last card, you've already won —
      // it plays like a plain Wild and no swap happens ("you would obviously
      // not win the game if you were required to swap your hand").
      if (!won) {
        const targetId = input.targetPlayerId;
        if (!targetId || !game.hands[targetId]) {
          throw new IllegalActionError('target_required', 'Choose a player to swap hands with.');
        }
        if (targetId === playerId) {
          throw new IllegalActionError('invalid_target', 'Choose a different player to swap with.');
        }
        const myHand = game.hands[playerId] ?? [];
        const theirHand = game.hands[targetId];
        game.hands[playerId] = theirHand;
        game.hands[targetId] = myHand;
        advanceTurn(game, 1);
      }
      break;
    }
    case 'wild_shuffle_hands': {
      // Same last-card exception as Swap Hands above.
      if (!won) {
        const pool = shuffle(Object.values(game.hands).flat());
        const order = game.turnOrder;
        const newHands: Record<string, Card[]> = {};
        for (const id of order) newHands[id] = [];
        // Deal starting with the player to the left of whoever played it (rules doc).
        let dealIdx = nextIndex(game.turnIndex, game.direction, order.length, 1);
        for (const c of pool) {
          newHands[order[dealIdx]].push(c);
          dealIdx = nextIndex(dealIdx, game.direction, order.length, 1);
        }
        game.hands = newHands;
        advanceTurn(game, 1);
      }
      break;
    }
    default:
      if (!won) advanceTurn(game, 1);
  }

  game.version += 1;
  game.updatedAt = new Date();
  return events;
}

export function drawCard(game: GameState, playerId: string): { drawn: Card | null; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  if (game.activeColor === 'wild') {
    throw new IllegalActionError('color_choice_pending', 'Waiting for the starting color to be chosen.');
  }
  if (game.turnOrder[game.turnIndex] !== playerId) {
    throw new IllegalActionError('not_your_turn', 'It is not your turn.');
  }
  if (game.pendingChallenge) {
    throw new IllegalActionError('challenge_pending', 'Resolve the Wild Draw Four challenge first.');
  }
  if (game.pendingDrawDecision) {
    throw new IllegalActionError('already_drawn', 'You already drew a card this turn.');
  }

  const [card] = drawCards(game, playerId, 1);
  if (!card) {
    // Both piles exhausted — pass without a card (extremely unlikely edge case).
    advanceTurn(game, 1);
    game.version += 1;
    game.updatedAt = new Date();
    return { drawn: null, events };
  }

  const topCard = game.discardPile[game.discardPile.length - 1];
  if (isLegalPlay(card, topCard, game.activeColor)) {
    game.pendingDrawDecision = { playerId, cardId: card.id };
  } else {
    advanceTurn(game, 1);
  }

  game.version += 1;
  game.updatedAt = new Date();
  return { drawn: card, events };
}

export function passTurn(game: GameState, playerId: string): void {
  if (game.turnOrder[game.turnIndex] !== playerId) {
    throw new IllegalActionError('not_your_turn', 'It is not your turn.');
  }
  if (!game.pendingDrawDecision || game.pendingDrawDecision.playerId !== playerId) {
    throw new IllegalActionError('nothing_to_pass', 'You have not drawn a card to pass on.');
  }
  game.pendingDrawDecision = null;
  advanceTurn(game, 1);
  game.version += 1;
  game.updatedAt = new Date();
}

export function callUno(game: GameState, playerId: string): void {
  const count = game.hands[playerId]?.length ?? 0;
  if (count !== 1) {
    throw new IllegalActionError('not_at_one_card', 'You can only call Uno with exactly one card left.');
  }
  game.pendingUnoCall = null;
  game.version += 1;
  game.updatedAt = new Date();
}

export function catchUno(game: GameState, targetPlayerId: string): EngineEvent[] {
  const events: EngineEvent[] = [];
  if (game.pendingUnoCall?.playerId !== targetPlayerId) {
    throw new IllegalActionError('nothing_to_catch', 'That player has already declared or has more than one card.');
  }
  drawCards(game, targetPlayerId, 2);
  events.push({ type: 'penalty_draw', playerId: targetPlayerId, count: 2, reason: 'uno_missed' });
  game.pendingUnoCall = null;
  game.version += 1;
  game.updatedAt = new Date();
  return events;
}

export function challengeWildDrawFour(game: GameState, challengerId: string): EngineEvent[] {
  const events: EngineEvent[] = [];
  const pending = game.pendingChallenge;
  if (!pending) {
    throw new IllegalActionError('nothing_to_challenge', 'There is no Wild Draw Four to challenge.');
  }
  if (pending.targetPlayerId !== challengerId) {
    throw new IllegalActionError('not_your_challenge', 'Only the player who drew can challenge.');
  }

  // Undo the optimistic 4-card draw before applying the real outcome.
  const targetHand = game.hands[pending.targetPlayerId] ?? [];
  const drawnSet = new Set(pending.drawnCardIds);
  game.hands[pending.targetPlayerId] = targetHand.filter((c) => !drawnSet.has(c.id));
  const returnedCards = targetHand.filter((c) => drawnSet.has(c.id));
  game.deck = [...game.deck, ...returnedCards];

  if (pending.hadLegalAlternative) {
    // Guilty: the original player draws 4 instead, and the challenger's turn is restored.
    drawCards(game, pending.playerId, 4);
    events.push({ type: 'penalty_draw', playerId: pending.playerId, count: 4, reason: 'challenge_lost' });
    game.turnIndex = game.turnOrder.indexOf(pending.targetPlayerId);
  } else {
    // Not guilty: the challenger draws 6 instead of 4 and stays skipped.
    drawCards(game, pending.targetPlayerId, 6);
    events.push({ type: 'penalty_draw', playerId: pending.targetPlayerId, count: 6, reason: 'challenge_lost' });
  }

  game.pendingChallenge = null;
  game.version += 1;
  game.updatedAt = new Date();
  return events;
}

/** Clears an unresolved Wild Draw Four challenge once its window has passed. */
export function expireChallengeIfPast(game: GameState): void {
  if (game.pendingChallenge && game.turnOrder[game.turnIndex] !== game.pendingChallenge.targetPlayerId) {
    game.pendingChallenge = null;
  }
}
