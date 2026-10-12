import { describe, expect, it } from 'vitest';
import { seatLayout } from '../src/utils/seating';

const table = (n: number) => Array.from({ length: n }, (_, seat) => ({ id: `p${seat}`, seat }));
const ids = (players: { id: string }[]) => players.map((p) => p.id);

describe('seatLayout', () => {
  it('puts a single opponent across the table', () => {
    const { left, top, right } = seatLayout(table(2), 'p0');
    expect([ids(left), ids(top), ids(right)]).toEqual([[], ['p1'], []]);
  });

  it('splits two opponents left and right', () => {
    const { left, top, right } = seatLayout(table(3), 'p0');
    expect([ids(left), ids(top), ids(right)]).toEqual([['p1'], [], ['p2']]);
  });

  it('seats a 4-player table left / across / right, so a 2v2 partner is on top', () => {
    // Team Mode alternates teams around the table: p0 and p2 are partners.
    const { left, top, right } = seatLayout(table(4), 'p0');
    expect([ids(left), ids(top), ids(right)]).toEqual([['p1'], ['p2'], ['p3']]);
  });

  it('orders seats clockwise from me, wrapping around the table', () => {
    const { left, top, right } = seatLayout(table(4), 'p2');
    expect([ids(left), ids(top), ids(right)]).toEqual([['p3'], ['p0'], ['p1']]);
  });

  it('lists the left column top-to-bottom, so the next player sits lowest', () => {
    // 7 players: 6 others, 2 per side. Next clockwise (p1) is lowest on the left.
    const { left, top, right } = seatLayout(table(7), 'p0');
    expect([ids(left), ids(top), ids(right)]).toEqual([
      ['p2', 'p1'],
      ['p3', 'p4'],
      ['p5', 'p6'],
    ]);
  });

  it('never loses or duplicates anyone, for every table size', () => {
    for (let n = 2; n <= 10; n++) {
      for (let me = 0; me < n; me++) {
        const { left, top, right } = seatLayout(table(n), `p${me}`);
        const seated = [...ids(left), ...ids(top), ...ids(right)].sort();
        const expected = ids(table(n))
          .filter((id) => id !== `p${me}`)
          .sort();
        expect(seated).toEqual(expected);
      }
    }
  });

  it('uses seat order, not array order', () => {
    const shuffled = [
      { id: 'c', seat: 2 },
      { id: 'a', seat: 0 },
      { id: 'd', seat: 3 },
      { id: 'b', seat: 1 },
    ];
    const { left, top, right } = seatLayout(shuffled, 'a');
    expect([ids(left), ids(top), ids(right)]).toEqual([['b'], ['c'], ['d']]);
  });

  it('shows everyone if I am not seated yet', () => {
    const { left, top, right } = seatLayout(table(3), 'nobody');
    expect(ids(left).length + ids(top).length + ids(right).length).toBe(3);
  });
});
