import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, RotateCcw, RotateCw, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { SOCKET_EVENTS, isLegalPlay, type Color } from '@uno/shared';
import { useGameState } from '../hooks/useGameState';
import { getStoredIdentity } from '../services/identity';
import OrientationGate from '../components/OrientationGate';
import Card from '../components/Card';
import Hand from '../components/Hand';
import GameControls from '../components/GameControls';
import { isSoundEnabled, playDrawSound, setSoundEnabled } from '../services/sound';

const REAL_COLORS: Exclude<Color, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

export default function Game() {
  const { roomCode = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = getStoredIdentity()!;
  const fallbackDisplayName = (location.state as { displayName?: string } | null)?.displayName ?? identity.name;
  const { socket, room, game, playerId, error, clearError } = useGameState(roomCode, fallbackDisplayName);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (room?.status === 'lobby') {
      navigate(`/room/${roomCode}/lobby`, { replace: true });
    } else if (room?.status === 'round_ended' || room?.status === 'match_ended') {
      navigate(`/room/${roomCode}/summary`, { replace: true });
    }
  }, [room?.status, roomCode, navigate]);

  if (!room || !game) {
    return (
      <div className="game-loading">
        <p>Loading game…</p>
      </div>
    );
  }

  const isMyTurn = game.turnPlayerId === playerId;
  const awaitingStartColor = game.activeColor === 'wild';
  const iChooseStartColor = awaitingStartColor && isMyTurn;
  const myPendingDraw = game.pendingDrawDecision?.playerId === playerId ? game.pendingDrawDecision : null;
  const myTeamId = room.players.find((p) => p.id === playerId)?.teamId;
  const teamMode = myTeamId !== undefined;

  const turnPlayerName = room.players.find((p) => p.id === game.turnPlayerId)?.displayName ?? 'someone';
  const iCanChallenge = game.pendingChallenge?.targetPlayerId === playerId;
  const unoCaller = room.players.find((p) => p.id === game.pendingUnoCall?.playerId);
  const canDraw = isMyTurn && !myPendingDraw && !game.pendingChallenge;
  const noPlayableCard =
    isMyTurn &&
    !awaitingStartColor &&
    !myPendingDraw &&
    !game.pendingChallenge &&
    !!game.discardTop &&
    !game.hand.some((c) => isLegalPlay(c, game.discardTop!, game.activeColor));

  const drawCard = () => {
    if (!canDraw) return;
    playDrawSound();
    socket.emit(SOCKET_EVENTS.GAME_DRAW_CARD, { roomCode });
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  };

  let statusMessage: string;
  if (game.pendingChallenge) {
    statusMessage = iCanChallenge
      ? 'Challenge the Wild Draw Four, or accept the draw'
      : `Waiting for the challenge to be resolved…`;
  } else if (myPendingDraw) {
    statusMessage = 'You drew a playable card — play it or pass';
  } else if (unoCaller) {
    statusMessage =
      unoCaller.id === playerId ? 'Call UNO before someone catches you!' : `${unoCaller.displayName} needs to call UNO!`;
  } else if (awaitingStartColor) {
    statusMessage = iChooseStartColor ? 'Choose the starting color' : `Waiting for ${turnPlayerName} to choose a color…`;
  } else if (noPlayableCard) {
    statusMessage = 'No matching card — draw from the pile';
  } else if (isMyTurn) {
    statusMessage = 'Your turn';
  } else {
    statusMessage = `${turnPlayerName}'s turn`;
  }

  const myHandCount = game.hand.length;

  return (
    <OrientationGate>
      <div className="uno-game">
        <header className="game-topbar">
          <div className="game-brand">
            <span className="brand-mark" aria-hidden="true">
              U
            </span>
            <strong>
              UNO<span>.</span>
            </strong>
          </div>
          <div className="game-title">
            <span>ROOM {roomCode}</span>
            <b>{teamMode ? 'Team match' : 'Game in progress'}</b>
          </div>
          <div className="game-actions">
            <span className="direction" title={game.direction === 1 ? 'Clockwise' : 'Counter-clockwise'}>
              {game.direction === 1 ? <RotateCw /> : <RotateCcw />}
            </span>
            <button
              type="button"
              className={`sound-toggle ${soundOn ? 'active' : ''}`}
              aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
              onClick={toggleSound}
            >
              {soundOn ? <Volume2 /> : <VolumeX />}
            </button>
          </div>
        </header>
        <button
          type="button"
          className="mobile-game-menu-button"
          aria-label="Open game menu"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu />
        </button>

        <section className="game-board" aria-label="UNO game board">
          <div className="opponent-strip">
            {room.players
              .filter((p) => p.id !== playerId)
              .map((p) => (
                <div
                  key={p.id}
                  className={`opponent ${p.id === game.turnPlayerId ? 'active-turn' : ''} ${
                    teamMode ? (p.teamId === myTeamId ? 'same-team' : 'opposing-team') : ''
                  }`}
                >
                  <span className="opponent-avatar">{initials(p.displayName)}</span>
                  <span className="opponent-info">
                    <strong>
                      {p.displayName}
                      {teamMode && p.teamId === myTeamId ? ' (your team)' : ''}
                    </strong>
                    <small>
                      {game.handCounts[p.id] ?? 0} cards
                      {p.connectionStatus !== 'connected' ? ' · reconnecting…' : ''}
                    </small>
                  </span>
                </div>
              ))}
          </div>

          <div className="table-ring" />

          <div className="center-pile">
            <motion.button
              type="button"
              className={`deck-stack ${noPlayableCard ? 'deck-stack-hint' : ''}`}
              disabled={!canDraw}
              aria-label={`Draw pile, ${game.drawPileCount} cards left`}
              onClick={drawCard}
              whileTap={canDraw ? { scale: 0.92, rotate: -4 } : undefined}
              animate={noPlayableCard ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={noPlayableCard ? { scale: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } } : undefined}
            >
              <div className="deck-card">UNO</div>
              <span className="deck-count">{game.drawPileCount}</span>
            </motion.button>
            <div className="discard-pile">
              <AnimatePresence mode="popLayout">
                {game.discardTop ? (
                  <motion.div
                    key={game.discardTop.id}
                    initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  >
                    <Card card={game.discardTop} small />
                  </motion.div>
                ) : (
                  <div className="uno-card uno-card-small uno-card-empty" />
                )}
              </AnimatePresence>
              <motion.span
                key={game.activeColor}
                className={`active-color-swatch color-${game.activeColor}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              />
            </div>
          </div>

          <div className="turn-status">
            <span className="live-dot" />
            <AnimatePresence mode="wait">
              <motion.span
                key={statusMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {statusMessage}
              </motion.span>
            </AnimatePresence>
          </div>

          {awaitingStartColor && (
            <div className="color-picker-overlay">
              <div className="color-picker">
                <p>{iChooseStartColor ? 'Choose the starting color' : `Waiting for ${turnPlayerName} to choose a color…`}</p>
                {iChooseStartColor && (
                  <div className="color-swatch-grid">
                    {REAL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-swatch color-${color}`}
                        onClick={() => socket.emit(SOCKET_EVENTS.GAME_CHOOSE_START_COLOR, { roomCode, color })}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="player-panel">
            <div className="player-label">
              <span>
                <b>You</b> · {myHandCount} card{myHandCount === 1 ? '' : 's'}
              </span>
              {myHandCount === 1 && <span className="uno-badge">UNO!</span>}
            </div>

            <Hand
              cards={game.hand}
              isMyTurn={isMyTurn && !awaitingStartColor}
              mustPlayCardId={myPendingDraw?.cardId ?? null}
              topCard={game.discardTop}
              activeColor={game.activeColor}
              otherPlayers={room.players
                .filter((p) => p.id !== playerId && (!teamMode || p.teamId !== myTeamId))
                .map((p) => ({ id: p.id, displayName: p.displayName }))}
              onPlay={(cardId, chosenColor, targetPlayerId) =>
                socket.emit(SOCKET_EVENTS.GAME_PLAY_CARD, { roomCode, cardId, chosenColor, targetPlayerId })
              }
            />

            <GameControls
              game={game}
              room={room}
              myPlayerId={playerId}
              onDraw={drawCard}
              onPass={() => socket.emit(SOCKET_EVENTS.GAME_PASS_TURN, { roomCode })}
              onCallUno={() => socket.emit(SOCKET_EVENTS.GAME_CALL_UNO, { roomCode })}
              onCatchUno={(targetPlayerId) => socket.emit(SOCKET_EVENTS.GAME_CATCH_UNO, { roomCode, targetPlayerId })}
              onChallenge={() => socket.emit(SOCKET_EVENTS.GAME_CHALLENGE_WILD_DRAW_FOUR, { roomCode })}
              onDeclineChallenge={() => socket.emit(SOCKET_EVENTS.GAME_DECLINE_CHALLENGE, { roomCode })}
            />
          </div>
        </section>

        <footer className="game-footer">
          <span>
            <Trophy /> First to empty their hand wins
          </span>
          <span>{room.players.length} players</span>
        </footer>

        {mobileMenuOpen && (
          <div className="mobile-game-menu-overlay" role="dialog" aria-modal="true" aria-label="Game menu">
            <div className="mobile-game-menu-panel">
              <button
                type="button"
                className="mobile-game-menu-close"
                aria-label="Close game menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X />
              </button>
              <p className="mobile-game-menu-room">ROOM {roomCode}</p>
              <p className="mobile-game-menu-mode">{teamMode ? 'Team match' : 'Game in progress'}</p>
              <div className="mobile-game-menu-actions">
                <span className="direction" title={game.direction === 1 ? 'Clockwise' : 'Counter-clockwise'}>
                  {game.direction === 1 ? <RotateCw /> : <RotateCcw />}
                  <b>{game.direction === 1 ? 'Clockwise' : 'Counter-clockwise'}</b>
                </span>
                <button
                  type="button"
                  className={`sound-toggle ${soundOn ? 'active' : ''}`}
                  aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
                  onClick={toggleSound}
                >
                  {soundOn ? <Volume2 /> : <VolumeX />}
                  <b>{soundOn ? 'Sound on' : 'Sound off'}</b>
                </button>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              className="error toast"
              onClick={clearError}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
            >
              {error.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </OrientationGate>
  );
}
