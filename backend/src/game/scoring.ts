import type { Card } from '@uno/shared';

/** Point table per spec FR-010. Wild Shuffle Hands is scored like Wild Swap Hands
 * (same rarity/power tier); the source rules doc doesn't list it separately. */
export function cardPointValue(card: Card): number {
  switch (card.type.kind) {
    case 'number':
      return card.type.value;
    case 'skip':
    case 'reverse':
    case 'draw_two':
      return 20;
    case 'wild':
    case 'wild_draw_four':
      return 50;
    case 'wild_swap_hands':
    case 'wild_shuffle_hands':
    case 'wild_customizable':
      return 40;
    default:
      return 0;
  }
}

export function handValue(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPointValue(c), 0);
}

export interface RoundScoreResult {
  winnerId: string;
  perPlayerCardsLeftValue: Record<string, number>;
  pointsAwardedToWinner: number;
}

/**
 * Round score: the winner is awarded the sum of every other player's
 * remaining hand value. In Team Mode (`teamOf` given), the winner's own
 * teammate's leftover hand doesn't count against anyone — only the opposing
 * team's hands are summed, and that total is what both teammates receive.
 */
export function computeRoundScore(
  hands: Record<string, Card[]>,
  winnerId: string,
  teamOf?: Record<string, 0 | 1>,
): RoundScoreResult {
  const perPlayerCardsLeftValue: Record<string, number> = {};
  let pointsAwardedToWinner = 0;
  const winnerTeam = teamOf?.[winnerId];
  for (const [playerId, hand] of Object.entries(hands)) {
    const value = playerId === winnerId ? 0 : handValue(hand);
    perPlayerCardsLeftValue[playerId] = value;
    if (playerId === winnerId) continue;
    const onWinningTeam = teamOf && winnerTeam !== undefined && teamOf[playerId] === winnerTeam;
    if (!onWinningTeam) pointsAwardedToWinner += value;
  }
  return { winnerId, perPlayerCardsLeftValue, pointsAwardedToWinner };
}
