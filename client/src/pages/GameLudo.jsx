import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LudoBoard, { LudoDie } from '../components/LudoBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';
import {
  PLAYER,
  PLAYERS,
  POINTS_CAPTURE,
  POINTS_HOME,
  POINTS_WIN,
  TOKEN_COUNT,
  TURN_ORDER,
  applyMove,
  cpuMove,
  finishedCount,
  initialState,
  legalMoves,
  passTurn,
  playerLabel,
  registerRoll,
  rollDice,
  scoreOf,
} from '../game/ludo.js';

const BEST_KEY = 'highscorehub-ludo-best';
const DICE_SPIN_MS = 420;
const CPU_ROLL_MS = 520;
const CPU_MOVE_MS = 420;
const TURN_PAUSE_MS = 360;

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

export default function GameLudo() {
  const { user } = useAuth();
  const [playState, setPlayState] = useState('waiting');
  const [game, setGame] = useState(initialState);
  const [phase, setPhase] = useState('roll');
  const [dice, setDice] = useState(null);
  const [diceSpin, setDiceSpin] = useState(6);
  const [rolling, setRolling] = useState(false);
  const [moves, setMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [banner, setBanner] = useState('');
  const [best, setBest] = useState(readBest);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
  const gameRef = useRef(game);
  const bestRef = useRef(best);
  const phaseRef = useRef(phase);
  const busyRef = useRef(false);
  const runIdRef = useRef(0);
  const timersRef = useRef([]);
  const audioRef = useRef(null);

  playStateRef.current = playState;
  gameRef.current = game;
  bestRef.current = best;
  phaseRef.current = phase;

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const sleep = useCallback((ms, runId) => {
    return new Promise((resolve) => {
      const id = window.setTimeout(() => {
        timersRef.current = timersRef.current.filter((timer) => timer !== id);
        resolve(runId === runIdRef.current);
      }, ms);
      timersRef.current.push(id);
    });
  }, []);

  const rememberBest = useCallback((score) => {
    if (score > bestRef.current) {
      bestRef.current = score;
      setBest(score);
      localStorage.setItem(BEST_KEY, String(score));
    }
  }, []);

  const endMatch = useCallback(
    (nextGame) => {
      clearTimers();
      playStateRef.current = 'ended';
      setPlayState('ended');
      setPhase('roll');
      setMoves([]);
      rememberBest(scoreOf(nextGame, PLAYER));
    },
    [clearTimers, rememberBest],
  );

  const presentRoll = useCallback(
    async (runId, value) => {
      setRolling(true);
      const start = Date.now();
      while (Date.now() - start < DICE_SPIN_MS) {
        setDiceSpin(1 + Math.floor(Math.random() * 6));
        const ok = await sleep(55, runId);
        if (!ok) {
          setRolling(false);
          return false;
        }
      }
      setDice(value);
      setDiceSpin(value);
      setRolling(false);
      playTone(audioRef, { type: 'triangle', startFreq: 280, endFreq: 180 + value * 70, duration: 0.12, volume: 0.07 });
      return true;
    },
    [sleep],
  );

  const playResultSounds = useCallback((result) => {
    if (result.captured) {
      playTone(audioRef, { type: 'square', startFreq: 420, endFreq: 180, duration: 0.16, volume: 0.07 });
    } else if (result.finished) {
      playTone(audioRef, { type: 'triangle', startFreq: 520, endFreq: 880, duration: 0.18, volume: 0.09 });
    } else {
      playTone(audioRef, { type: 'sine', startFreq: 320, endFreq: 220, duration: 0.1, volume: 0.06 });
    }
  }, []);

  const runCpuTurns = useCallback(
    async (runId) => {
      while (runId === runIdRef.current && playStateRef.current === 'playing') {
        const current = gameRef.current;
        if (current.winner || current.turn === PLAYER) {
          break;
        }

        setPhase('cpu');
        setMoves([]);
        setBanner(`${playerLabel(current.turn)} is rolling…`);
        const ready = await sleep(CPU_ROLL_MS, runId);
        if (!ready) {
          return;
        }

        const value = rollDice();
        const shown = await presentRoll(runId, value);
        if (!shown) {
          return;
        }

        const rolled = registerRoll(gameRef.current, value);
        gameRef.current = rolled.state;
        setGame(rolled.state);

        if (rolled.forfeited) {
          setBanner(`${playerLabel(current.turn)} rolled three 6s — turn skipped`);
          await sleep(TURN_PAUSE_MS, runId);
          continue;
        }

        const move = cpuMove(gameRef.current, gameRef.current.turn, value);
        if (!move) {
          if (value === 6) {
            setBanner(`${playerLabel(gameRef.current.turn)} rolled a 6 but cannot move — rolling again`);
          } else {
            setBanner(`${playerLabel(gameRef.current.turn)} cannot move`);
            const next = passTurn(gameRef.current);
            gameRef.current = next;
            setGame(next);
          }
          await sleep(TURN_PAUSE_MS, runId);
          continue;
        }

        setBanner(`${playerLabel(gameRef.current.turn)} rolled a ${value}`);
        const moved = await sleep(CPU_MOVE_MS, runId);
        if (!moved) {
          return;
        }

        const result = applyMove(gameRef.current, gameRef.current.turn, move.tokenIndex, value);
        if (!result) {
          break;
        }

        gameRef.current = result.state;
        setGame(result.state);
        setLastMove({ playerId: current.turn, tokenIndex: move.tokenIndex });
        playResultSounds(result);

        if (result.captured) {
          setBanner(`${playerLabel(current.turn)} sent ${playerLabel(result.captured.playerId)} home!`);
        } else if (result.finished) {
          setBanner(`${playerLabel(current.turn)} got a token home!`);
        }

        if (result.state.winner) {
          endMatch(result.state);
          return;
        }
      }

      if (runId === runIdRef.current && playStateRef.current === 'playing' && !gameRef.current.winner) {
        setPhase('roll');
        setDice(null);
        setMoves([]);
        setBanner('Your turn — tap the dice');
      }
    },
    [endMatch, playResultSounds, presentRoll, sleep],
  );

  const startGame = useCallback(() => {
    runIdRef.current += 1;
    clearTimers();
    const next = initialState();
    gameRef.current = next;
    playStateRef.current = 'playing';
    busyRef.current = false;
    setGame(next);
    setPlayState('playing');
    setPhase('roll');
    setDice(null);
    setDiceSpin(6);
    setRolling(false);
    setMoves([]);
    setLastMove(null);
    setBanner('Your turn — tap the dice');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
  }, [clearTimers]);

  const handleRoll = useCallback(async () => {
    if (playStateRef.current !== 'playing' || gameRef.current.turn !== PLAYER || busyRef.current) {
      return;
    }
    if (phaseRef.current !== 'roll') {
      return;
    }

    const runId = runIdRef.current;
    busyRef.current = true;
    setPhase('rolling');
    const value = rollDice();
    const shown = await presentRoll(runId, value);
    if (!shown) {
      return;
    }

    const rolled = registerRoll(gameRef.current, value);
    gameRef.current = rolled.state;
    setGame(rolled.state);

    if (rolled.forfeited) {
      setBanner('Three 6s in a row — turn skipped');
      setPhase('cpu');
      setMoves([]);
      await sleep(TURN_PAUSE_MS, runId);
      busyRef.current = false;
      runCpuTurns(runId);
      return;
    }

    const nextMoves = legalMoves(gameRef.current, PLAYER, value);
    if (nextMoves.length === 0) {
      if (value === 6) {
        setBanner('No move for that 6 — roll again');
        setPhase('roll');
        setMoves([]);
        busyRef.current = false;
        return;
      }
      setBanner('No moves — passing the turn');
      const next = passTurn(gameRef.current);
      gameRef.current = next;
      setGame(next);
      setPhase('cpu');
      setMoves([]);
      await sleep(TURN_PAUSE_MS, runId);
      busyRef.current = false;
      runCpuTurns(runId);
      return;
    }

    setMoves(nextMoves);
    setPhase('move');
    busyRef.current = false;
    setBanner(nextMoves.length === 1 ? 'Tap your glowing token' : 'Tap a glowing token to move');
  }, [presentRoll, runCpuTurns, sleep]);

  const handlePlay = useCallback(
    (tokenIndex) => {
      if (playStateRef.current !== 'playing' || phaseRef.current !== 'move' || gameRef.current.turn !== PLAYER) {
        return;
      }
      if (!dice || busyRef.current) {
        return;
      }

      const result = applyMove(gameRef.current, PLAYER, tokenIndex, dice);
      if (!result) {
        return;
      }

      busyRef.current = true;
      gameRef.current = result.state;
      setGame(result.state);
      setLastMove({ playerId: PLAYER, tokenIndex });
      setMoves([]);
      playResultSounds(result);

      if (result.captured) {
        setBanner(`You sent ${playerLabel(result.captured.playerId)} home!`);
      } else if (result.finished) {
        setBanner('Your token made it home!');
      }

      if (result.state.winner) {
        endMatch(result.state);
        return;
      }

      if (result.extraTurn) {
        setPhase('roll');
        setDice(null);
        busyRef.current = false;
        setBanner(result.captured || result.finished || dice === 6 ? 'Bonus roll — tap the dice' : 'Your turn — tap the dice');
        return;
      }

      setPhase('cpu');
      busyRef.current = false;
      runCpuTurns(runIdRef.current);
    },
    [dice, endMatch, playResultSounds, runCpuTurns],
  );

  useEffect(() => {
    function onKeyDown(event) {
      if (playStateRef.current !== 'playing') {
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        if (phaseRef.current === 'roll' && gameRef.current.turn === PLAYER) {
          event.preventDefault();
          handleRoll();
        }
        return;
      }
      if (phaseRef.current !== 'move' || !/^[1-4]$/.test(event.key)) {
        return;
      }
      event.preventDefault();
      handlePlay(Number(event.key) - 1);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePlay, handleRoll]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      clearTimers();
    };
  }, [clearTimers]);

  const { isExpanded, handleQuit } = useGameExpand({
    playState,
    onPause: () => {
      if (playStateRef.current === 'playing') {
        runIdRef.current += 1;
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
      const saved = await submitScore(scoreOf(game, PLAYER), 'ludo');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'ended';
  const playing = playState === 'playing';
  const boardLocked = overlayOpen || phase !== 'move';
  const playerScore = scoreOf(game, PLAYER);
  const playerWon = game.winner === PLAYER;
  const dieValue = rolling ? diceSpin : dice || diceSpin;
  const kicker =
    playState === 'waiting'
      ? 'Press Start, roll a 6 to leave the yard, and get all 4 tokens home'
      : playState === 'playing'
        ? `You are pink · roll a 6 to come out · Space rolls, 1–4 moves a token`
        : '';

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className={`puzzle-page ludo-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>You</span>
              <strong>{playerScore}</strong>
            </div>
            <div className="puzzle-score">
              <span>Home</span>
              <strong>
                {finishedCount(game, PLAYER)}/{TOKEN_COUNT}
              </strong>
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

        <div className="ludo-homes" aria-label="Tokens home">
          {TURN_ORDER.map((id) => (
            <div key={id} className={`ludo-home-chip is-${id}${game.turn === id && playing ? ' is-turn' : ''}`}>
              <span>{id === PLAYER ? 'You' : PLAYERS[id].name}</span>
              <strong>
                {finishedCount(game, id)}/{TOKEN_COUNT}
              </strong>
            </div>
          ))}
        </div>

        {playing ? (
          <p className="ttt-turn" aria-live="polite">
            {banner}
          </p>
        ) : null}

        {playing ? (
          <div className="ludo-die-wrap">
            <LudoDie value={dieValue} rolling={rolling} disabled={phase !== 'roll' || rolling} onRoll={handleRoll} />
            <p>{phase === 'roll' ? 'Tap to roll' : rolling ? 'Rolling…' : `Rolled ${dice || dieValue}`}</p>
          </div>
        ) : null}

        <div className="puzzle-stage ludo-stage">
          <LudoBoard
            tokens={game.tokens}
            legalMoves={moves}
            lastMove={lastMove}
            onPlay={handlePlay}
            disabled={boardLocked}
          />

          {playState === 'waiting' && (
            <div className="overlay" onClick={startGame}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>
                  You are pink. Roll a 6 to leave the yard, race around the board, and get all four tokens home before
                  Green, Yellow, and Blue.
                </p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/ludo" onClick={(event) => event.stopPropagation()}>
                    How to play
                  </Link>
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}

          {playState === 'ended' && (
            <div className="overlay">
              <div className={`panel overlay-panel${playerWon ? ' overlay-win' : ''}`}>
                <h2>{playerWon ? 'You win!' : 'Nice try!'}</h2>
                <p className="final-score">{playerScore}</p>
                <p>
                  {playerWon
                    ? 'All four tokens made it home. That’s a Ludo win!'
                    : `${playerLabel(game.winner)} got all four tokens home first. Tap Play again and race them back.`}
                </p>
                <p>
                  Home tokens {POINTS_HOME} pts · captures {POINTS_CAPTURE} pts · win bonus {POINTS_WIN}.
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
                      <Link className="button" to="/signin" state={{ from: '/game/ludo' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/ludo' }}>
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
                    <Link className="button button-secondary" to="/leaderboard?game=ludo">
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
