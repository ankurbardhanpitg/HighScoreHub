import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import WhackBoard from '../components/WhackBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

const HOLE_COUNT = 9;
const MIN_SECONDS = 10;
const MAX_SECONDS = 90;
const STEP_SECONDS = 5;
const DEFAULT_SECONDS = 30;
const BEST_KEY = 'highscorehub-whack-best';
const TIME_KEY = 'highscorehub-whack-round';

function readBest() {
  const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function clampRoundSeconds(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_SECONDS;
  }
  const stepped = Math.round(parsed / STEP_SECONDS) * STEP_SECONDS;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, stepped));
}

function readRoundSeconds() {
  return clampRoundSeconds(localStorage.getItem(TIME_KEY) || DEFAULT_SECONDS);
}

function timings(timeLeft, roundSeconds) {
  const total = Math.max(roundSeconds, 1);
  const progress = Math.min(1, Math.max(0, 1 - timeLeft / total));
  return {
    upMs: Math.round(1050 - progress * 500),
    gapMs: Math.round(260 - progress * 130),
  };
}

function nextHole(previous) {
  let hole = Math.floor(Math.random() * HOLE_COUNT);
  if (hole === previous) {
    hole = (hole + 1 + Math.floor(Math.random() * (HOLE_COUNT - 1))) % HOLE_COUNT;
  }
  return hole;
}

function playBonk(audioRef) {
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
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(220, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  } catch {
    // Ignore audio errors so a blocked sound never stops play.
  }
}

export default function GameWhack() {
  const { user } = useAuth();
  const [playState, setPlayState] = useState('waiting');
  const [roundSeconds, setRoundSeconds] = useState(readRoundSeconds);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [timeLeft, setTimeLeft] = useState(readRoundSeconds);
  const [streak, setStreak] = useState(0);
  const [activeHole, setActiveHole] = useState(null);
  const [bonkedHole, setBonkedHole] = useState(null);
  const [missHole, setMissHole] = useState(null);
  const [popText, setPopText] = useState('+1');
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
  const roundSecondsRef = useRef(roundSeconds);
  const scoreRef = useRef(score);
  const bestRef = useRef(best);
  const timeLeftRef = useRef(timeLeft);
  const activeHoleRef = useRef(activeHole);
  const streakRef = useRef(0);
  const lastHoleRef = useRef(null);
  const hideTimerRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const tickRef = useRef(null);
  const missTimerRef = useRef(null);
  const lockRef = useRef(false);
  const audioRef = useRef(null);

  playStateRef.current = playState;
  roundSecondsRef.current = roundSeconds;
  scoreRef.current = score;
  bestRef.current = best;
  timeLeftRef.current = timeLeft;
  activeHoleRef.current = activeHole;

  const clearTimers = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(spawnTimerRef.current);
    window.clearTimeout(missTimerRef.current);
    window.clearInterval(tickRef.current);
    hideTimerRef.current = null;
    spawnTimerRef.current = null;
    missTimerRef.current = null;
    tickRef.current = null;
  }, []);

  const endGame = useCallback(() => {
    clearTimers();
    playStateRef.current = 'ended';
    activeHoleRef.current = null;
    setActiveHole(null);
    setBonkedHole(null);
    setPlayState('ended');
  }, [clearTimers]);

  const spawnMole = useCallback(() => {
    if (playStateRef.current !== 'playing' || timeLeftRef.current <= 0) {
      return;
    }

    const { upMs, gapMs } = timings(timeLeftRef.current, roundSecondsRef.current);
    const hole = nextHole(lastHoleRef.current);
    lastHoleRef.current = hole;
    lockRef.current = false;
    activeHoleRef.current = hole;
    setBonkedHole(null);
    setActiveHole(hole);

    hideTimerRef.current = window.setTimeout(() => {
      activeHoleRef.current = null;
      setActiveHole(null);
      streakRef.current = 0;
      setStreak(0);
      spawnTimerRef.current = window.setTimeout(spawnMole, gapMs);
    }, upMs);
  }, []);

  const startGame = useCallback(() => {
    clearTimers();
    const round = roundSecondsRef.current;
    scoreRef.current = 0;
    timeLeftRef.current = round;
    activeHoleRef.current = null;
    lastHoleRef.current = null;
    streakRef.current = 0;
    lockRef.current = false;
    playStateRef.current = 'playing';
    setScore(0);
    setTimeLeft(round);
    setStreak(0);
    setActiveHole(null);
    setBonkedHole(null);
    setMissHole(null);
    setPlayState('playing');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');

    tickRef.current = window.setInterval(() => {
      const next = timeLeftRef.current - 1;
      timeLeftRef.current = next;
      setTimeLeft(next);
      if (next <= 0) {
        endGame();
      }
    }, 1000);

    spawnMole();
  }, [clearTimers, endGame, spawnMole]);

  const { isExpanded, handleQuit } = useGameExpand({
    playState,
    onPause: () => {
      if (playStateRef.current === 'playing') {
        clearTimers();
      }
    },
  });

  const handleWhack = useCallback(
    (index) => {
      if (playStateRef.current !== 'playing') {
        return;
      }

      if (activeHoleRef.current !== index) {
        if (lockRef.current) {
          return;
        }
        setMissHole(index);
        streakRef.current = 0;
        setStreak(0);
        window.clearTimeout(missTimerRef.current);
        missTimerRef.current = window.setTimeout(() => setMissHole(null), 180);
        return;
      }

      window.clearTimeout(hideTimerRef.current);
      lockRef.current = true;
      activeHoleRef.current = null;
      setActiveHole(null);
      setBonkedHole(index);

      const nextScore = scoreRef.current + 1;
      scoreRef.current = nextScore;
      setScore(nextScore);
      streakRef.current += 1;
      setStreak(streakRef.current);
      setPopText(streakRef.current >= 5 ? `+1 x${streakRef.current}` : '+1');

      if (nextScore > bestRef.current) {
        bestRef.current = nextScore;
        setBest(nextScore);
        localStorage.setItem(BEST_KEY, String(nextScore));
      }

      playBonk(audioRef);
      spawnTimerRef.current = window.setTimeout(() => {
        lockRef.current = false;
        spawnMole();
      }, 140);
    },
    [spawnMole],
  );

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  function changeRound(delta) {
    if (playStateRef.current === 'playing') {
      return;
    }

    const next = clampRoundSeconds(roundSecondsRef.current + delta);
    roundSecondsRef.current = next;
    setRoundSeconds(next);
    setTimeLeft(next);
    localStorage.setItem(TIME_KEY, String(next));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || submitState === 'saving' || submitState === 'saved') {
      return;
    }

    setSubmitState('saving');
    setSubmitError('');

    try {
      const saved = await submitScore(score, 'whack');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'ended';
  const playing = playState === 'playing';
  const kicker =
    playState === 'waiting'
      ? 'Set your time, press Start, then tap moles as they pop up'
      : playState === 'playing'
        ? `Tap the moles the instant they peek out · ${roundSeconds} seconds on the clock`
        : '';

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className={`puzzle-page whack-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>Score</span>
              <strong>{score}</strong>
            </div>
            <div className={`puzzle-score${timeLeft <= 5 && playing ? ' is-urgent' : ''}`}>
              <span>Time</span>
              <strong>{playing ? timeLeft : roundSeconds}</strong>
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

        <TimeLimitControl seconds={roundSeconds} disabled={playing} onChange={changeRound} />

        <div className="puzzle-stage whack-stage">
          <WhackBoard
            activeHole={activeHole}
            bonkedHole={bonkedHole}
            missHole={missHole}
            popText={popText}
            onWhack={handleWhack}
            disabled={overlayOpen}
          />

          {playState === 'waiting' && (
            <div className="overlay" onClick={startGame}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>Moles pop out of the holes. Tap them fast before they hide!</p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/whack" onClick={(event) => event.stopPropagation()}>
                    How to play
                  </Link>
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}

          {playState === 'ended' && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>Time’s up!</h2>
                <p className="final-score">You scored {score}!</p>
                {streak >= 5 ? <p>Nice streak — those reflexes are sharp.</p> : <p>Tap Start and try for an even bigger bonk streak.</p>}
                <TimeLimitControl seconds={roundSeconds} disabled={false} onChange={changeRound} />

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
                      <Link className="button" to="/signin" state={{ from: '/game/whack' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/whack' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && savedAt && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Super speedy!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={startGame}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=whack">
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

function TimeLimitControl({ seconds, disabled, onChange }) {
  return (
    <div className="whack-time-control" onClick={(event) => event.stopPropagation()}>
      <span>Time limit</span>
      <button
        className="button whack-time-btn"
        type="button"
        disabled={disabled || seconds <= MIN_SECONDS}
        aria-label="Decrease time limit"
        onClick={() => onChange(-STEP_SECONDS)}
      >
        −
      </button>
      <strong>{seconds}s</strong>
      <button
        className="button whack-time-btn"
        type="button"
        disabled={disabled || seconds >= MAX_SECONDS}
        aria-label="Increase time limit"
        onClick={() => onChange(STEP_SECONDS)}
      >
        +
      </button>
    </div>
  );
}
