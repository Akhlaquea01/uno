import type { Card as CardType, PlayerView } from '@uno/shared';
import Card from './Card';

export interface SeatProps {
  player: PlayerView;
  cardCount: number;
  isTurn: boolean;
  /** Same team as me (Team Mode only). */
  isTeammate: boolean;
  /** A teammate's face-up hand. Only ever passed for teammates — opponents get counts. */
  teammateHand?: CardType[];
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

/** One other player at the table: avatar, name, card count, and — for a teammate in
 * Team Mode — their hand face up. */
export default function Seat({ player, cardCount, isTurn, isTeammate, teammateHand }: SeatProps) {
  const teamClass = player.teamId !== undefined ? `team-${player.teamId}` : '';

  return (
    <div className={`seat ${isTurn ? 'active-turn' : ''} ${teamClass} ${isTeammate ? 'same-team' : ''}`}>
      <div className="seat-chip">
        <span className="seat-avatar">{initials(player.displayName)}</span>
        <span className="seat-info">
          <strong title={player.displayName}>{player.displayName}</strong>
          <small>
            {cardCount} card{cardCount === 1 ? '' : 's'}
            {isTeammate ? ' · teammate' : ''}
            {player.connectionStatus !== 'connected' ? ' · reconnecting…' : ''}
          </small>
        </span>
      </div>
      {teammateHand && teammateHand.length > 0 && (
        <div className="mini-hand" aria-label={`${player.displayName}'s cards`}>
          {teammateHand.map((card) => (
            <Card key={card.id} card={card} mini />
          ))}
        </div>
      )}
    </div>
  );
}
