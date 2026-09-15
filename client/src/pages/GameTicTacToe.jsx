import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import TicTacToeBoard from '../components/TicTacToeBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';
import {
  CPU,
  PLAYER,
  WIN_SCORE,
  cpuMove,
  emptyBoard,
  getWinner,
  getWinningLine,
  isDraw,
} from '../game/tictactoe.js';

const BEST_KEY = 'highscorehub-tictactoe-best';
const CPU_THINK_MS = 420;
const NEXT_ROUND_MS = 900;

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

export default function GameTicTacToe() {
  const { user } = useAuth();
  const [playState, setPlayState] = useState('waiting');
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(PLAYER);
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [winningLine, setWinningLine] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
  const boardRef = useRef(board);
  const turnRef = useRef(turn);
  const playerScoreRef = useRef(playerScore);
  const cpuScoreRef = useRef(cpuScore);
  const bestRef = useRef(best);
  const cpuTimerRef = useRef(null);
  const roundTimerRef = useRef(null);
  const audioRef = useRef(null);

  playStateRef.current = playState;
  boardRef.current = board;
  turnRef.current = turn;
  playerScoreRef.current = playerScore;
  cpuScoreRef.current = cpuScore;
  bestRef.current = best;

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
    const nextBoard = emptyBoard();
    boardRef.current = nextBoard;
    turnRef.current = PLAYER;
    setBoard(nextBoard);
    setTurn(PLAYER);
    setWinningLine(null);
    setLastMove(null);
    setRoundResult(null);
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
    (result, line) => {
      setRoundResult(result);
      setWinningLine(line);
      turnRef.current = null;
      setTurn(null);

      if (result === PLAYER) {
        playTone(audioRef, { type: 'triangle', startFreq: 520, endFreq: 880, duration: 0.18, volume: 0.09 });
        const next = playerScoreRef.current + 1;
        playerScoreRef.current = next;
        setPlayerScore(next);
        if (next >= WIN_SCORE) {
          roundTimerRef.current = window.setTimeout(endMatch, NEXT_ROUND_MS);
          return;
        }
      } else if (result === CPU) {
        playTone(audioRef, { type: 'sine', startFreq: 240, endFreq: 90, duration: 0.22, volume: 0.08 });
        const next = cpuScoreRef.current + 1;
        cpuScoreRef.current = next;
        setCpuScore(next);
        if (next >= WIN_SCORE) {
          roundTimerRef.current = window.setTimeout(endMatch, NEXT_ROUND_MS);
          return;
        }
      } else {
        playTone(audioRef, { type: 'triangle', startFreq: 280, endFreq: 220, duration: 0.14, volume: 0.06 });
      }

      roundTimerRef.current = window.setTimeout(() => {
        if (playStateRef.current === 'playing') {
          beginRound();
        }
      }, NEXT_ROUND_MS);
    },
    [beginRound, endMatch],
  );

  const placeMark = useCallback(
    (index, mark) => {
      if (playStateRef.current !== 'playing' || turnRef.current !== mark || boardRef.current[index]) {
        return false;
      }

      const nextBoard = boardRef.current.slice();
      nextBoard[index] = mark;
      boardRef.current = nextBoard;
      setBoard(nextBoard);
      setLastMove(index);

      if (mark === PLAYER) {
        playTone(audioRef, { type: 'triangle', startFreq: 420, endFreq: 640, duration: 0.09, volume: 0.07 });
      } else {
        playTone(audioRef, { type: 'sine', startFreq: 320, endFreq: 240, duration: 0.1, volume: 0.06 });
      }

      const winner = getWinner(nextBoard);
      if (winner) {
        finishRound(winner, getWinningLine(nextBoard));
        return true;
      }

      if (isDraw(nextBoard)) {
        finishRound('draw', null);
        return true;
      }

      const nextTurn = mark === PLAYER ? CPU : PLAYER;
      turnRef.current = nextTurn;
      setTurn(nextTurn);
      return true;
    },
    [finishRound],
  );

  const handlePlay = useCallback(
    (index) => {
      placeMark(index, PLAYER);
    },
    [placeMark],
  );

  useEffect(() => {
    if (playState !== 'playing' || turn !== CPU || roundResult) {
      return undefined;
    }

    cpuTimerRef.current = window.setTimeout(() => {
      const index = cpuMove(boardRef.current);
      if (index != null) {
        placeMark(index, CPU);
      }
    }, CPU_THINK_MS);

    return () => {
      window.clearTimeout(cpuTimerRef.current);
    };
  }, [playState, turn, roundResult, board, placeMark]);

  useEffect(() => {
    function onKeyDown(event) {
      if (playStateRef.current !== 'playing' || turnRef.current !== PLAYER) {
        return;
      }
      const key = event.key;
      if (!/^[1-9]$/.test(key)) {
        return;
      }
      event.preventDefault();
      placeMark(Number(key) - 1, PLAYER);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [placeMark]);

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
      const saved = await submitScore(playerScore, 'tictactoe');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'ended';
  const playing = playState === 'playing';
  const boardLocked = overlayOpen || turn !== PLAYER || Boolean(roundResult);
  const playerWonMatch = playerScore >= WIN_SCORE;
  const kicker =
    playState === 'waiting'
      ? `Press Start, then tap a square to place X · first to ${WIN_SCORE} wins`
      : playState === 'playing'
        ? `You are X · numbers 1–9 also work · first to ${WIN_SCORE} beats the computer`
        : '';

  let turnText = 'Your turn — tap a square';
  if (roundResult === PLAYER) {
    turnText = playerScore >= WIN_SCORE ? 'You won the match!' : 'You take this round!';
  } else if (roundResult === CPU) {
    turnText = cpuScore >= WIN_SCORE ? 'The computer won the match' : 'The computer takes this round';
  } else if (roundResult === 'draw') {
    turnText = 'It’s a draw — next round coming up';
  } else if (turn === CPU) {
    turnText = 'Computer is thinking…';
  }

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className={`puzzle-page ttt-page${isExpanded ? ' is-expanded' : ''}`}>
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

        <div className="puzzle-stage ttt-stage">
          <TicTacToeBoard
            board={board}
            winningLine={winningLine}
            lastMove={lastMove}
            onPlay={handlePlay}
            disabled={boardLocked}
          />

          {playState === 'waiting' && (
            <div className="overlay" onClick={startGame}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>
                  You are X. Get three in a row before the computer does. First to {WIN_SCORE} wins the match!
                </p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link
                    className="button button-secondary"
                    to="/howto/tictactoe"
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
                    ? 'Three in a row, five times — that’s a match win!'
                    : 'The computer got to 5 first. Tap Play again and steal the next match.'}
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
                      <Link className="button" to="/signin" state={{ from: '/game/tictactoe' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/tictactoe' }}>
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
                    <Link className="button button-secondary" to="/leaderboard?game=tictactoe">
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
