import { describe, it, expect } from 'vitest';
import type { Card } from '@uno/shared';
import { buildGameView } from '../../src/sockets/views';

const card = (id: string): Card => ({ id, color: 'red', type: { kind: 'number', value: 1 } });

// Seat order alternates teams, as arrangeTeamSeats produces: A, B, A, B.
const hands = {
  a1: [card('a1-0'), card('a1-1')],
  b1: [card('b1-0')],
  a2: [card('a2-0'), card('a2-1'), card('a2-2')],
  b2: [card('b2-0')],
};

const game = {
  roomCode: 'ROOM01',
  version: 3,
  hands,
  discardPile: [card('top')],
  deck: [card('d1')],
  activeColor: 'red',
  turnIndex: 0,
  turnOrder: ['a1', 'b1', 'a2', 'b2'],
  direction: 1,
  pendingUnoCall: null,
  pendingChallenge: null,
  pendingDrawDecision: null,
};

const teamPlayers = [
  { id: 'a1', teamId: 0 },
  { id: 'b1', teamId: 1 },
  { id: 'a2', teamId: 0 },
  { id: 'b2', teamId: 1 },
];

const teamRoom = { code: 'ROOM01', status: 'in_progress', settings: { teamMode: true }, players: teamPlayers };

describe('buildGameView teammate hands', () => {
  it('gives a player exactly their teammate\'s hand, never their own again or an opponent\'s', () => {
    const view = buildGameView(game, teamRoom, 'a1');

    expect(view.hand).toEqual(hands.a1);
    expect(Object.keys(view.teammateHands ?? {})).toEqual(['a2']);
    expect(view.teammateHands?.a2).toEqual(hands.a2);
    expect(JSON.stringify(view)).not.toContain('b1-0');
    expect(JSON.stringify(view)).not.toContain('b2-0');
  });

  it('never leaks one team\'s cards to the other team', () => {
    const view = buildGameView(game, teamRoom, 'b1');

    expect(Object.keys(view.teammateHands ?? {})).toEqual(['b2']);
    expect(JSON.stringify(view)).not.toContain('a1-0');
    expect(JSON.stringify(view)).not.toContain('a2-0');
  });

  it('shows every teammate in a bigger team, but nobody else', () => {
    const sixGame = {
      ...game,
      hands: { ...hands, a3: [card('a3-0')], b3: [card('b3-0')] },
      turnOrder: ['a1', 'b1', 'a2', 'b2', 'a3', 'b3'],
    };
    const sixRoom = {
      ...teamRoom,
      players: [...teamPlayers, { id: 'a3', teamId: 0 }, { id: 'b3', teamId: 1 }],
    };

    const view = buildGameView(sixGame, sixRoom, 'a2');

    expect(Object.keys(view.teammateHands ?? {}).sort()).toEqual(['a1', 'a3']);
  });

  it('is absent outside Team Mode, even if players still carry a stale teamId', () => {
    const room = { ...teamRoom, settings: { teamMode: false } };

    const view = buildGameView(game, room, 'a1');

    expect(view).not.toHaveProperty('teammateHands');
    expect(view.hand).toEqual(hands.a1);
  });

  it('is absent when the viewer has not been put on a team', () => {
    const room = {
      ...teamRoom,
      players: teamPlayers.map((p) => (p.id === 'a1' ? { id: 'a1', teamId: null } : p)),
    };

    expect(buildGameView(game, room, 'a1')).not.toHaveProperty('teammateHands');
  });

  it('still reports hand counts for everyone so opponents stay count-only', () => {
    const view = buildGameView(game, teamRoom, 'a1');

    expect(view.handCounts).toEqual({ a1: 2, b1: 1, a2: 3, b2: 1 });
  });
});
