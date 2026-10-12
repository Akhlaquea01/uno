export interface TableSeats<T> {
  /** Top to bottom. */
  left: T[];
  /** Left to right. */
  top: T[];
  /** Top to bottom. */
  right: T[];
}

/** Arranges everyone but me around the table as seen from my seat at the bottom:
 * play runs clockwise, so the next seat is on my left, then across the top, then my
 * right. In Team Mode seats alternate teams, so a 2v2 partner always lands on top.
 *
 * One or two opponents sit across / left+right; with three or more, each side takes
 * a third (min 1) and the rest go on top (4 → 1/2/1, 6 → 2/2/2, 9 → 3/3/3). */
export function seatLayout<T extends { id: string; seat: number }>(players: T[], myId: string): TableSeats<T> {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const myIndex = ordered.findIndex((p) => p.id === myId);
  const others =
    myIndex === -1 ? ordered : [...ordered.slice(myIndex + 1), ...ordered.slice(0, myIndex)];

  const count = others.length;
  const side = count <= 2 ? Math.floor(count / 2) : Math.max(1, Math.floor(count / 3));

  return {
    // Closest clockwise is lowest, so the column (rendered top-down) is reversed.
    left: others.slice(0, side).reverse(),
    top: others.slice(side, count - side),
    right: others.slice(count - side),
  };
}
