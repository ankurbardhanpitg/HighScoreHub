import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useChessRoom } from '../hooks/useChessRoom.js';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { chessRoomUrl } from '../game/chessRoom.js';
import {
  BLACK,
  WHITE,
  capturedPieces,
  colorOf,
  findMove,
  getStatus,
  glyphOf,
  isPromotionMove,
  kingSquare,
  legalMovesFrom,
} from '../game/chess.js';

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

export default function GameChessRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const displayName = user?.username || 'Guest';
  const { snapshot, error, connected, sendMove, resign, rematch } = useChessRoom(roomId, displayName);

  const color = snapshot?.color || WHITE;
  const room = snapshot?.room || null;
  const game = room?.game || null;
  const waiting = Boolean(room && room.status === 'waiting');
  const playing = Boolean(room && room.status === 'playing');
  const ended = Boolean(room && room.status === 'ended');
  const opponentName = color === WHITE ? room?.names?.b : room?.names?.w;
  const youName = color === WHITE ? room?.names?.w : room?.names?.b;
  const opponentConnected = color === WHITE ? room?.connected?.b : room?.connected?.w;

  const [selected, setSelected] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const audioRef = useRef(null);
  const lastMoveKeyRef = useRef('');

  const status = useMemo(() => (game ? getStatus(game) : { inCheck: false, result: null }), [game]);
  const legalTargets = useMemo(() => {
    if (!game || selected == null) {
      return [];
    }
    return legalMovesFrom(game, selected).map((move) => move.to);
  }, [game, selected]);
  const captured = useMemo(() => (game ? capturedPieces(game.board) : { byWhite: [], byBlack: [] }), [game]);
  const checkSquare = game && status.inCheck ? kingSquare(game.board, game.turn) : -1;
  const shareUrl = room ? chessRoomUrl(room.id) : chessRoomUrl(roomId);

  const playState = ended ? 'ended' : playing || waiting ? 'playing' : 'waiting';
  const { isExpanded, handleQuit } = useGameExpand({ playState });

  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [room?.lastMove?.from, room?.lastMove?.to, room?.status, color]);

  useEffect(() => {
    if (!room?.lastMove) {
      return;
    }
    const key = `${room.lastMove.from}-${room.lastMove.to}-${room.game?.turn || ''}`;
    if (lastMoveKeyRef.current === key) {
      return;
    }
    lastMoveKeyRef.current = key;
    if (game && game.turn === color) {
      playTone(audioRef, { type: 'sine', startFreq: 320, endFreq: 240, duration: 0.1, volume: 0.06 });
    }
  }, [color, game, room?.lastMove]);

  const yourTurn = Boolean(playing && game && game.turn === color && !room.result);
  const boardLocked = !yourTurn || Boolean(pendingPromotion) || Boolean(error);

  const handleSquare = useCallback(
    (sq) => {
      if (!yourTurn || !game || pendingPromotion) {
        return;
      }

      const piece = game.board[sq];

      if (selected != null) {
        if (isPromotionMove(game, selected, sq) && findMove(game, selected, sq)) {
          setPendingPromotion({ from: selected, to: sq });
          return;
        }
        const move = findMove(game, selected, sq);
        if (move) {
          playTone(audioRef, { type: 'triangle', startFreq: 420, endFreq: 640, duration: 0.08, volume: 0.07 });
          sendMove(move);
          setSelected(null);
          return;
        }
      }

      if (piece && colorOf(piece) === color) {
        setSelected(sq === selected ? null : sq);
        return;
      }

      setSelected(null);
    },
    [color, game, pendingPromotion, selected, sendMove, yourTurn],
  );

  const handlePromote = useCallback(
    (type) => {
      if (!pendingPromotion || !game) {
        return;
      }
      const move = findMove(game, pendingPromotion.from, pendingPromotion.to, type);
      if (move) {
        playTone(audioRef, { type: 'triangle', startFreq: 420, endFreq: 640, duration: 0.08, volume: 0.07 });
        sendMove(move);
        setPendingPromotion(null);
        setSelected(null);
      }
    },
    [game, pendingPromotion, sendMove],
  );

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
  const theyWon = ended && room?.result && room.result !== 'draw' && room.result !== color;
  const overlayOpen = Boolean(error) || !room || waiting || ended;

  let turnText = yourTurn
    ? 'Your turn — tap a piece, then tap where it can go'
    : `Waiting for ${opponentName || 'your friend'}…`;
  if (waiting) {
    turnText = 'Share the link. The game starts when your friend joins.';
  } else if (ended && youWon) {
    turnText = room?.reason === 'resign' ? 'Your friend resigned — you win!' : 'Checkmate — you win!';
  } else if (ended && theyWon) {
    turnText = room?.reason === 'resign' ? 'You resigned' : 'Checkmate — your friend wins';
  } else if (ended && room?.result === 'draw') {
    turnText = room?.reason === 'material' ? 'Not enough pieces left — it’s a draw' : 'Stalemate — it’s a draw';
  } else if (pendingPromotion) {
    turnText = 'Pawn made it! Pick a piece to promote to';
  } else if (status.inCheck && game?.turn === color) {
    turnText = 'Check! Move your king out of danger';
  } else if (status.inCheck) {
    turnText = `${opponentName || 'Your friend'} is in check`;
  } else if (playing && !connected) {
    turnText = 'Reconnecting to the room…';
  } else if (playing && !opponentConnected) {
    turnText = 'Your friend disconnected. Wait a moment — they can rejoin this same link.';
  }

  const kicker = waiting
    ? 'Invite a friend with the room link · you are White, they are Black'
    : playing
      ? `You are ${color === WHITE ? 'White' : 'Black'} · play live with ${opponentName || 'your friend'}`
      : '';

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className={`puzzle-page chess-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>You</span>
              <strong>{youName || displayName}</strong>
            </div>
            <div className={`puzzle-score${playing && !opponentConnected ? ' is-urgent' : ''}`}>
              <span>Friend</span>
              <strong>{waiting ? '…' : opponentName || 'Guest'}</strong>
            </div>
            <div className="puzzle-score">
              <span>You play</span>
              <strong>{color === WHITE ? 'White' : 'Black'}</strong>
            </div>
          </div>
          <div className="puzzle-hud-actions">
            {playing ? (
              <button className="button button-pink puzzle-new" type="button" onClick={resign}>
                Resign
              </button>
            ) : null}
            <QuitGameButton className="button button-secondary puzzle-new" onClick={handleQuit} />
          </div>
        </div>

        {room ? <p className="ttt-turn">{turnText}</p> : null}

        {game && (playing || ended) ? (
          <div className="chess-captures" aria-label="Captured pieces">
            <p>
              <span>{color === WHITE ? 'You took' : `${room.names?.w || 'White'} took`}</span>
              <strong>
                {captured.byWhite.length > 0
                  ? captured.byWhite.map((piece, index) => (
                      <span key={`w-${piece}-${index}`}>{glyphOf(piece)}</span>
                    ))
                  : '—'}
              </strong>
            </p>
            <p>
              <span>{color === BLACK ? 'You took' : `${room.names?.b || 'Black'} took`}</span>
              <strong>
                {captured.byBlack.length > 0
                  ? captured.byBlack.map((piece, index) => (
                      <span key={`b-${piece}-${index}`}>{glyphOf(piece)}</span>
                    ))
                  : '—'}
              </strong>
            </p>
          </div>
        ) : null}

        <div className="puzzle-stage chess-stage">
          <ChessBoard
            board={game?.board || Array.from({ length: 64 }, () => null)}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={room?.lastMove}
            checkSquare={checkSquare}
            pendingPromotion={pendingPromotion}
            onSquare={handleSquare}
            onPromote={handlePromote}
            onCancelPromote={() => setPendingPromotion(null)}
            disabled={boardLocked}
            playerColor={color}
          />

          {overlayOpen ? (
            <div className="overlay">
              <div className={`panel overlay-panel${youWon ? ' overlay-win' : ''}`}>
                {error ? (
                  <>
                    <h2>Can’t join</h2>
                    <p>{error}</p>
                    <div className="actions">
                      <Link className="button button-play" to="/game/chess">
                        Back to chess
                      </Link>
                      <QuitGameButton onClick={handleQuit} />
                    </div>
                  </>
                ) : ended ? (
                  <>
                    <h2>{youWon ? 'You win!' : theyWon ? 'Nice try!' : 'Draw!'}</h2>
                    <p>
                      {youWon
                        ? room?.reason === 'resign'
                          ? 'Your friend resigned. Want another game?'
                          : 'Checkmate! Want another game in this room?'
                        : theyWon
                          ? room?.reason === 'resign'
                            ? 'You resigned this game. Try again?'
                            : 'Your friend got checkmate. Try again?'
                          : 'Nobody can checkmate from here. Play again?'}
                    </p>
                    <div className="actions">
                      <button className="button button-play" type="button" onClick={rematch}>
                        Play again
                      </button>
                      <Link className="button" to="/game/chess">
                        Vs computer
                      </Link>
                      <QuitGameButton onClick={handleQuit} />
                    </div>
                  </>
                ) : waiting ? (
                  <>
                    <h2>Invite a friend</h2>
                    <p>Share this link or room code. When they open it, you play chess together.</p>
                    <div className="chess-share">
                      <p className="chess-code" aria-label="Room code">
                        {room.id}
                      </p>
                      <label htmlFor="chess-share-url">Room link</label>
                      <div className="chess-share-row">
                        <input id="chess-share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                        <button className="button" type="button" onClick={copyShareLink}>
                          {copied ? 'Copied!' : 'Copy link'}
                        </button>
                      </div>
                      {copyError ? <p className="error">{copyError}</p> : null}
                    </div>
                    <p className="chess-share-hint">You are White. They will be Black. Waiting for them to join…</p>
                    <div className="actions">
                      <Link className="button button-secondary" to="/game/chess">
                        Vs computer
                      </Link>
                      <QuitGameButton onClick={handleQuit} />
                    </div>
                  </>
                ) : (
                  <>
                    <h2>Connecting…</h2>
                    <p>Joining the chess room.</p>
                    <div className="actions">
                      <QuitGameButton onClick={handleQuit} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
