import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LudoBoard, { LudoDie } from '../components/LudoBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { useLudoRoom } from '../hooks/useLudoRoom.js';
import { colorName, finishedCount, legalMoves, TOKEN_COUNT, TURN_ORDER } from '../game/ludo.js';
import { ludoRoomUrl } from '../game/ludoRoom.js';

function playTone(audioRef, { type, startFreq, endFreq, duration, volume = 0.08 }) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = audioRef.current || new AudioCtx();
    audioRef.current = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Ignore audio errors so a blocked sound never stops play.
  }
}

function seatName(room, color) {
  return room?.seats?.[color]?.name || colorName(color);
}

export default function GameLudoRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const displayName = user?.username || 'Guest';
  const { snapshot, error, connected, sendRoll, sendMove, startMatch, resign, rematch } = useLudoRoom(
    roomId,
    displayName,
  );

  const color = snapshot?.color || 'red';
  const room = snapshot?.room || null;
  const game = room?.game || null;
  const waiting = Boolean(room && room.status === 'waiting');
  const playing = Boolean(room && room.status === 'playing');
  const ended = Boolean(room && room.status === 'ended');
  const isHost = room?.hostColor === color;
  const yourTurn = Boolean(playing && game && game.turn === color && !room.result);
  const shareUrl = room ? ludoRoomUrl(room.id) : ludoRoomUrl(roomId);

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [diceSpin, setDiceSpin] = useState(6);
  const [rolling, setRolling] = useState(false);
  const audioRef = useRef(null);
  const lastMoveKeyRef = useRef('');
  const lastDiceKeyRef = useRef('');
  const spinTimerRef = useRef(null);

  const playState = ended ? 'ended' : playing || waiting ? 'playing' : 'waiting';
  const { isExpanded, handleQuit } = useGameExpand({ playState });

  const moves = useMemo(() => {
    if (!game || !yourTurn || room?.phase !== 'move' || room?.dice == null) {
      return [];
    }
    return legalMoves(game, color, room.dice);
  }, [color, game, room?.dice, room?.phase, yourTurn]);

  useEffect(() => {
    return () => {
      window.clearInterval(spinTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (room?.dice == null) {
      return;
    }
    const key = `${room.dice}-${room.phase}-${game?.turn || ''}-${room.lastEvent || ''}`;
    if (lastDiceKeyRef.current === key) {
      return;
    }
    lastDiceKeyRef.current = key;
    window.clearInterval(spinTimerRef.current);
    setRolling(true);
    const start = Date.now();
    spinTimerRef.current = window.setInterval(() => {
      setDiceSpin(1 + Math.floor(Math.random() * 6));
      if (Date.now() - start >= 380) {
        window.clearInterval(spinTimerRef.current);
        setDiceSpin(room.dice);
        setRolling(false);
      }
    }, 55);
    playTone(audioRef, { type: 'triangle', startFreq: 280, endFreq: 180 + room.dice * 70, duration: 0.12, volume: 0.07 });
  }, [game?.turn, room?.dice, room?.lastEvent, room?.phase]);

  useEffect(() => {
    if (!room?.lastMove) {
      return;
    }
    const key = `${room.lastMove.playerId}-${room.lastMove.tokenIndex}-${game?.turn || ''}`;
    if (lastMoveKeyRef.current === key) {
      return;
    }
    lastMoveKeyRef.current = key;
    if (yourTurn) {
      playTone(audioRef, { type: 'sine', startFreq: 320, endFreq: 220, duration: 0.1, volume: 0.06 });
    }
  }, [game?.turn, room?.lastMove, yourTurn]);

  const handleRoll = useCallback(() => {
    if (!yourTurn || room?.phase !== 'roll' || rolling) {
      return;
    }
    sendRoll();
  }, [rolling, room?.phase, sendRoll, yourTurn]);

  const handlePlay = useCallback(
    (tokenIndex) => {
      if (!yourTurn || room?.phase !== 'move') {
        return;
      }
      playTone(audioRef, { type: 'triangle', startFreq: 360, endFreq: 220, duration: 0.1, volume: 0.07 });
      sendMove(tokenIndex);
    },
    [room?.phase, sendMove, yourTurn],
  );

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === ' ' || event.key === 'Enter') {
        if (yourTurn && room?.phase === 'roll') {
          event.preventDefault();
          handleRoll();
        }
        return;
      }
      if (!yourTurn || room?.phase !== 'move' || !/^[1-4]$/.test(event.key)) {
        return;
      }
      event.preventDefault();
      handlePlay(Number(event.key) - 1);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePlay, handleRoll, room?.phase, yourTurn]);

  async function copyShareLink(event) {
    event?.preventDefault();
    event?.stopPropagation();
    setCopyError('');
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Could not copy. Select the link and copy it yourself.');
    }
  }

  const youWon = ended && room?.result === color;
  const theyWon = ended && room?.result && room.result !== color;
  const boardLocked = !yourTurn || room?.phase !== 'move' || Boolean(error);
  const dieValue = rolling ? diceSpin : room?.dice || diceSpin;
  const winnerName = room?.result ? seatName(room, room.result) : '';

  let turnText = yourTurn
    ? room?.phase === 'move'
      ? 'Tap a glowing token to move'
      : 'Your turn — tap the dice'
    : `Waiting for ${game ? seatName(room, game.turn) : 'your friend'}…`;
  if (waiting) {
    turnText = isHost
      ? 'Share the link. Start when at least two people are in.'
      : 'Waiting for the host to start. More friends can still join.';
  } else if (ended && youWon) {
    turnText = room?.reason === 'resign' ? 'Everyone else left — you win!' : 'All four tokens home — you win!';
  } else if (ended && theyWon) {
    turnText = `${winnerName} got all four tokens home first`;
  } else if (playing && !connected) {
    turnText = 'Reconnecting to the room…';
  } else if (playing && room?.lastEvent) {
    turnText = yourTurn ? `${room.lastEvent}. Your turn — tap the dice` : room.lastEvent;
    if (yourTurn && room.phase === 'move') {
      turnText = `${room.lastEvent}. Tap a glowing token`;
    }
  }

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      <div className={`puzzle-page ludo-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="ludo-layout">
          <div className="puzzle-stage ludo-stage">
            <LudoBoard
              tokens={game?.tokens || []}
              legalMoves={moves}
              lastMove={room?.lastMove}
              onPlay={handlePlay}
              disabled={boardLocked}
              playerColor={color}
            />
          </div>

          <aside className="ludo-side">
            <div className="puzzle-hud">
              <div className="puzzle-scores">
                <div className="puzzle-score">
                  <span>You</span>
                  <strong>{room?.seats?.[color]?.name || displayName}</strong>
                </div>
                <div className="puzzle-score">
                  <span>You play</span>
                  <strong>{colorName(color)}</strong>
                </div>
                <div className="puzzle-score">
                  <span>Players</span>
                  <strong>{room?.playerCount || 1}/4</strong>
                </div>
              </div>
              <div className="puzzle-hud-actions">
                {playing ? (
                  <button className="button button-pink puzzle-new" type="button" onClick={resign}>
                    Leave race
                  </button>
                ) : null}
                <QuitGameButton className="button button-secondary puzzle-new" onClick={handleQuit} />
              </div>
            </div>

            {room ? <p className="ttt-turn">{turnText}</p> : null}

            {error ? (
              <div className="chess-panel">
                <h2>Can’t join</h2>
                <p>{error}</p>
                <div className="actions">
                  <Link className="button button-play" to="/game/ludo">
                    Back to Ludo
                  </Link>
                </div>
              </div>
            ) : ended ? (
              <div className={`chess-panel${youWon ? ' overlay-win' : ''}`}>
                <h2>{youWon ? 'You win!' : 'Nice try!'}</h2>
                <p>
                  {youWon
                    ? room?.reason === 'resign'
                      ? 'The others left the race. Want another game in this room?'
                      : 'All four tokens made it home. Play again in this room?'
                    : `${winnerName} finished first. Try again?`}
                </p>
                <div className="actions">
                  <button className="button button-play" type="button" onClick={rematch}>
                    Play again
                  </button>
                  <Link className="button" to="/game/ludo">
                    Vs computer
                  </Link>
                </div>
              </div>
            ) : waiting ? (
              <div className="chess-panel">
                <h2>Invite friends</h2>
                <p>Share this link or room code. 2 to 4 people can play. The game starts when the host taps Start, or when the fourth player joins.</p>
                <div className="chess-share">
                  <p className="chess-code" aria-label="Room code">
                    {room.id}
                  </p>
                  <label htmlFor="ludo-share-url">Room link</label>
                  <div className="chess-share-row">
                    <input id="ludo-share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                    <button className="button" type="button" onClick={copyShareLink}>
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                  {copyError ? <p className="error">{copyError}</p> : null}
                </div>
                <p className="chess-share-hint">
                  You are {colorName(color)}. {isHost ? 'You can start with 2 or more players.' : 'Waiting for the host…'}
                </p>
                <div className="actions">
                  {isHost ? (
                    <button
                      className="button button-play"
                      type="button"
                      onClick={startMatch}
                      disabled={(room.playerCount || 0) < 2}
                    >
                      {(room.playerCount || 0) < 2 ? 'Need a friend' : 'Start game'}
                    </button>
                  ) : null}
                  <Link className="button button-secondary" to="/game/ludo">
                    Vs computer
                  </Link>
                </div>
              </div>
            ) : !room ? (
              <div className="chess-panel">
                <h2>{connected ? 'Joining…' : 'Connecting…'}</h2>
                <p>
                  {connected
                    ? 'Almost there — opening the Ludo room.'
                    : 'Connecting to the Ludo room. If this hangs, refresh the page.'}
                </p>
                {error ? <p className="error">{error}</p> : null}
                <div className="actions">
                  <Link className="button button-secondary" to="/game/ludo">
                    Back to Ludo
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="ludo-homes" aria-label="Players in this room">
              {TURN_ORDER.map((id) => {
                const seat = room?.seats?.[id];
                const classes = ['ludo-home-chip', `is-${id}`];
                if (game?.turn === id && playing) {
                  classes.push('is-turn');
                }
                if (!seat) {
                  classes.push('is-empty');
                }
                if (seat && !seat.connected && (playing || ended)) {
                  classes.push('is-away');
                }
                return (
                  <div key={id} className={classes.join(' ')}>
                    <span>{seat ? seat.name : colorName(id)}</span>
                    <strong>{game ? `${finishedCount(game, id)}/${TOKEN_COUNT}` : seat ? 'In' : 'Open'}</strong>
                  </div>
                );
              })}
            </div>

            {(playing || ended) && (
            <div className="ludo-die-wrap">
              <LudoDie
                value={dieValue}
                rolling={rolling}
                disabled={!yourTurn || room?.phase !== 'roll' || rolling || !playing}
                onRoll={handleRoll}
              />
              <p>
                {rolling
                  ? 'Rolling…'
                  : yourTurn && room?.phase === 'roll'
                    ? 'Tap to roll'
                    : room?.dice
                      ? `Rolled ${room.dice}`
                      : 'Waiting'}
              </p>
            </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
