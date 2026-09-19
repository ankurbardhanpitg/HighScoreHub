import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';
import {
  CPU,
  PLAYER,
  WIN_SCORE,
  applyMove,
  capturedPieces,
  colorOf,
  cpuMove,
  findMove,
  getStatus,
  glyphOf,
  inCheck,
  initialState,
  isPromotionMove,
  kingSquare,
  legalMovesFrom,
} from '../game/chess.js';

const BEST_KEY = 'highscorehub-chess-best';
const CPU_THINK_MS = 520;
const NEXT_ROUND_MS = 1400;

function readBest() {
  const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

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

export default function GameChess() {
  const { user } = useAuth();
  const [playState, setPlayState] = useState('waiting');
  const [game, setGame] = useState(initialState);
  const [selected, setSelected] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [roundResult, setRoundResult] = useState(null);
  const [roundReason, setRoundReason] = useState(null);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
  const gameRef = useRef(game);
  const roundResultRef = useRef(roundResult);
  const playerScoreRef = useRef(playerScore);
  const cpuScoreRef = useRef(cpuScore);
  const bestRef = useRef(best);
  const cpuTimerRef = useRef(null);
  const roundTimerRef = useRef(null);
  const audioRef = useRef(null);

  playStateRef.current = playState;
  gameRef.current = game;
  roundResultRef.current = roundResult;
  playerScoreRef.current = playerScore;
  cpuScoreRef.current = cpuScore;
  bestRef.current = best;

  const status = useMemo(() => getStatus(game), [game]);
  const legalTargets = useMemo(() => {
    if (selected == null) {
      return [];
    }
    return legalMovesFrom(game, selected).map((move) => move.to);
  }, [game, selected]);
  const captured = useMemo(() => capturedPieces(game.board), [game.board]);
  const checkSquare = status.inCheck ? kingSquare(game.board, game.turn) : -1;

  const clearTimers = useCallback(() => {
    window.clearTimeout(cpuTimerRef.current);
    window.clearTimeout(roundTimerRef.current);
    cpuTimerRef.current = null;
    roundTimerRef.current = null;
  }, []);

  const rememberBest = useCallback((score) => {
    if (score > bestRef.current) {
      bestRef.current = score;
      setBest(score);
      localStorage.setItem(BEST_KEY, String(score));
    }
  }, []);

  const endMatch = useCallback(() => {
    clearTimers();
    playStateRef.current = 'ended';
    setPlayState('ended');
    rememberBest(playerScoreRef.current);
  }, [clearTimers, rememberBest]);

  const beginRound = useCallback(() => {
    clearTimers();
    const next = initialState();
    gameRef.current = next;
    setGame(next);
    setSelected(null);
    setPendingPromotion(null);
    setLastMove(null);
    roundResultRef.current = null;
    setRoundResult(null);
    setRoundReason(null);
  }, [clearTimers]);

  const startGame = useCallback(() => {
    playerScoreRef.current = 0;
    cpuScoreRef.current = 0;
    playStateRef.current = 'playing';
    setPlayerScore(0);
    setCpuScore(0);
    setPlayState('playing');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
    beginRound();
  }, [beginRound]);

  const finishRound = useCallback(
    (result, reason) => {
      roundResultRef.current = result;
      setRoundResult(result);
      setRoundReason(reason);
      setSelected(null);
      setPendingPromotion(null);

      if (result === PLAYER) {
        playTone(audioRef, { type: 'triangle', startFreq: 520, endFreq: 880, duration: 0.2, volume: 0.09 });
        const next = playerScoreRef.current + 1;
        playerScoreRef.current = next;
        setPlayerScore(next);
        if (next >= WIN_SCORE) {
          roundTimerRef.current = window.setTimeout(endMatch, NEXT_ROUND_MS);
          return;
        }
      } else if (result === CPU) {
        playTone(audioRef, { type: 'sine', startFreq: 240, endFreq: 90, duration: 0.24, volume: 0.08 });
        const next = cpuScoreRef.current + 1;
        cpuScoreRef.current = next;
        setCpuScore(next);
        if (next >= WIN_SCORE) {
          roundTimerRef.current = window.setTimeout(endMatch, NEXT_ROUND_MS);
          return;
        }
      } else {
        playTone(audioRef, { type: 'triangle', startFreq: 280, endFreq: 220, duration: 0.16, volume: 0.06 });
      }

      roundTimerRef.current = window.setTimeout(() => {
        if (playStateRef.current === 'playing') {
          beginRound();
        }
      }, NEXT_ROUND_MS);
    },
    [beginRound, endMatch],
  );

  const playMove = useCallback(
    (move) => {
      if (playStateRef.current !== 'playing' || roundResultRef.current) {
        return false;
      }

      const current = gameRef.current;
      const mover = current.board[move.from];
      if (!mover || current.turn !== colorOf(mover)) {
        return false;
      }

      const next = applyMove(current, move);
      gameRef.current = next;
      setGame(next);
      setSelected(null);
      setPendingPromotion(null);
      setLastMove({ from: move.from, to: move.to });

      if (current.turn === PLAYER) {
        playTone(audioRef, { type: 'triangle', startFreq: 420, endFreq: 640, duration: 0.08, volume: 0.07 });
      } else {
        playTone(audioRef, { type: 'sine', startFreq: 320, endFreq: 240, duration: 0.1, volume: 0.06 });
      }

      const nextStatus = getStatus(next);
      if (nextStatus.result) {
        finishRound(nextStatus.result, nextStatus.reason);
        return true;
      }

      if (inCheck(next)) {
        playTone(audioRef, { type: 'square', startFreq: 660, endFreq: 420, duration: 0.12, volume: 0.05 });
      }

      return true;
    },
    [finishRound],
  );

  const handleSquare = useCallback(
    (sq) => {
      if (playStateRef.current !== 'playing' || roundResultRef.current || pendingPromotion) {
        return;
      }
      if (gameRef.current.turn !== PLAYER) {
        return;
      }

      const current = gameRef.current;
      const piece = current.board[sq];

      if (selected != null) {
        if (isPromotionMove(current, selected, sq) && findMove(current, selected, sq)) {
          setPendingPromotion({ from: selected, to: sq });
          return;
        }
        const move = findMove(current, selected, sq);
        if (move) {
          playMove(move);
          return;
        }
      }

      if (piece && colorOf(piece) === PLAYER) {
        setSelected(sq === selected ? null : sq);
        return;
      }

      setSelected(null);
    },
    [pendingPromotion, playMove, selected],
  );

  const handlePromote = useCallback(
    (type) => {
      if (!pendingPromotion) {
        return;
      }
      const move = findMove(gameRef.current, pendingPromotion.from, pendingPromotion.to, type);
      if (move) {
        playMove(move);
      }
    },
    [pendingPromotion, playMove],
  );

  useEffect(() => {
    if (playState !== 'playing' || game.turn !== CPU || roundResult) {
      return undefined;
    }

    if (roundResultRef.current) {
      return undefined;
    }

    cpuTimerRef.current = window.setTimeout(() => {
      const move = cpuMove(gameRef.current);
      if (move) {
        playMove(move);
      }
    }, CPU_THINK_MS);

    return () => {
      window.clearTimeout(cpuTimerRef.current);
    };
  }, [playState, game, roundResult, playMove]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const { isExpanded, handleQuit } = useGameExpand({
    playState,
    onPause: () => {
      if (playStateRef.current === 'playing') {
        clearTimers();
      }
    },
  });

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || submitState === 'saving' || submitState === 'saved') {
      return;
    }

    setSubmitState('saving');
    setSubmitError('');

    try {
      const saved = await submitScore(playerScore, 'chess');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'ended';
  const playing = playState === 'playing';
  const boardLocked = overlayOpen || game.turn !== PLAYER || Boolean(roundResult);
  const playerWonMatch = playerScore >= WIN_SCORE;
  const kicker =
    playState === 'waiting'
      ? `Press Start, then move your white pieces · first to ${WIN_SCORE} wins`
      : playState === 'playing'
        ? `You are White · tap a piece, then a dotted square · first to ${WIN_SCORE} beats the computer`
        : '';

  let turnText = 'Your turn — tap a piece, then tap where it can go';
  if (roundResult === PLAYER) {
    turnText = playerScore >= WIN_SCORE ? 'You won the match!' : 'Checkmate — you take this round!';
  } else if (roundResult === CPU) {
    turnText = cpuScore >= WIN_SCORE ? 'The computer won the match' : 'Checkmate — the computer takes this round';
  } else if (roundResult === 'draw') {
    turnText =
      roundReason === 'material' ? 'Not enough pieces left — it’s a draw' : 'Stalemate — it’s a draw';
  } else if (pendingPromotion) {
    turnText = 'Pawn made it! Pick a piece to promote to';
  } else if (status.inCheck && game.turn === PLAYER) {
    turnText = 'Check! Move your king out of danger';
  } else if (status.inCheck && game.turn === CPU) {
    turnText = 'The computer is in check…';
  } else if (game.turn === CPU) {
    turnText = 'Computer is thinking…';
  }

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className={`puzzle-page chess-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>You</span>
              <strong>{playerScore}</strong>
            </div>
            <div className="puzzle-score">
              <span>CPU</span>
              <strong>{cpuScore}</strong>
            </div>
            <div className="puzzle-score">
              <span>Best</span>
              <strong>{best}</strong>
            </div>
          </div>
          <div className="puzzle-hud-actions">
            {playing ? (
              <button className="button button-pink puzzle-new" type="button" onClick={startGame}>
                Restart
              </button>
            ) : null}
            <QuitGameButton className="button button-secondary puzzle-new" onClick={handleQuit} />
          </div>
        </div>

        {playing ? <p className="ttt-turn">{turnText}</p> : null}

        {playing ? (
          <div className="chess-captures" aria-label="Captured pieces">
            <p>
              <span>You took</span>
              <strong>
                {captured.byWhite.length > 0
                  ? captured.byWhite.map((piece, index) => (
                      <span key={`w-${piece}-${index}`}>{glyphOf(piece)}</span>
                    ))
                  : '—'}
              </strong>
            </p>
            <p>
              <span>CPU took</span>
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
            board={game.board}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            checkSquare={checkSquare}
            pendingPromotion={pendingPromotion}
            onSquare={handleSquare}
            onPromote={handlePromote}
            onCancelPromote={() => setPendingPromotion(null)}
            disabled={boardLocked}
          />

          {playState === 'waiting' && (
            <div className="overlay" onClick={startGame}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>
                  You are White. Checkmate the computer’s king to win a round. First to {WIN_SCORE}{' '}
                  wins the match!
                </p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link
                    className="button button-secondary"
                    to="/howto/chess"
                    onClick={(event) => event.stopPropagation()}
                  >
                    How to play
                  </Link>
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}

          {playState === 'ended' && (
            <div className="overlay">
              <div className={`panel overlay-panel${playerWonMatch ? ' overlay-win' : ''}`}>
                <h2>{playerWonMatch ? 'You win!' : 'Nice try!'}</h2>
                <p className="final-score">
                  {playerScore} – {cpuScore}
                </p>
                <p>
                  {playerWonMatch
                    ? 'Checkmate three times — that’s a match win!'
                    : 'The computer got to 3 first. Tap Play again and steal the next match.'}
                </p>

                {user ? (
                  <form onSubmit={handleSubmit} className="score-form">
                    <p>Save this score as {user.username}?</p>
                    <button className="button" type="submit" disabled={submitState === 'saving' || submitState === 'saved'}>
                      {submitState === 'saved' ? 'Score saved!' : submitState === 'saving' ? 'Saving...' : 'Save my score'}
                    </button>
                  </form>
                ) : (
                  <div className="score-form">
                    <p>Sign in to put this score on the board.</p>
                    <div className="actions">
                      <Link className="button" to="/signin" state={{ from: '/game/chess' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/chess' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && savedAt && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Great game!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={startGame}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=chess">
                      High scores
                    </Link>
                  ) : null}
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
