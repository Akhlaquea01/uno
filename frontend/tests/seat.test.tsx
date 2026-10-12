import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Card, PlayerView } from '@uno/shared';
import Seat from '../src/components/Seat';

const player = (overrides: Partial<PlayerView> = {}): PlayerView => ({
  id: 'p1',
  userId: 'u1',
  displayName: 'Bilal',
  connectionStatus: 'connected',
  seat: 1,
  isHost: false,
  matchScore: 0,
  handCount: 0,
  ...overrides,
});

const hand: Card[] = [
  { id: 'c1', color: 'red', type: { kind: 'number', value: 5 } },
  { id: 'c2', color: 'blue', type: { kind: 'skip' } },
  { id: 'c3', color: 'wild', type: { kind: 'wild_draw_four' } },
];

describe('Seat', () => {
  it('shows a teammate\'s hand face-up beside their name', () => {
    render(<Seat player={player({ teamId: 0 })} cardCount={3} isTurn={false} isTeammate teammateHand={hand} />);

    const cards = within(screen.getByLabelText("Bilal's cards")).getAllByLabelText(/ card$/);
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
      '5 red card',
      'skip blue card',
      'wild draw four wild card',
    ]);
    expect(screen.getByText(/teammate/)).toBeInTheDocument();
  });

  it('shows an opponent as a count only, never card faces', () => {
    const { container } = render(
      <Seat player={player({ teamId: 1 })} cardCount={4} isTurn={false} isTeammate={false} />,
    );

    expect(screen.getByText(/4 cards/)).toBeInTheDocument();
    expect(container.querySelector('.uno-card')).toBeNull();
    expect(container.querySelector('.mini-hand')).toBeNull();
  });

  it('uses the singular for one card and flags a reconnecting player', () => {
    render(
      <Seat
        player={player({ connectionStatus: 'reconnecting' })}
        cardCount={1}
        isTurn={false}
        isTeammate={false}
      />,
    );

    expect(screen.getByText(/1 card · reconnecting…/)).toBeInTheDocument();
  });

  it('marks the player whose turn it is and carries the team accent', () => {
    const { container } = render(<Seat player={player({ teamId: 1 })} cardCount={7} isTurn isTeammate={false} />);

    expect(container.firstElementChild).toHaveClass('active-turn', 'team-1');
  });
});
