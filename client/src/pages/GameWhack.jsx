import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import WhackBoard from '../components/WhackBoard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

const HOLE_COUNT = 9;
const ROUND_SECONDS = 30;
const BEST_KEY = 'highscorehub-whack-best';

function readBest() {
  const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function timings(timeLeft) {
  const progress = 1 - timeLeft / ROUND_SECONDS;
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
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [streak, setStreak] = useState(0);
  const [activeHole, setActiveHole] = useState(null);
  const [bonkedHole, setBonkedHole] = useState(null);
  const [missHole, setMissHole] = useState(null);
  const [popText, setPopText] = useState('+1');
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
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

    const { upMs, gapMs } = timings(timeLeftRef.current);
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
    scoreRef.current = 0;
    timeLeftRef.current = ROUND_SECONDS;
    activeHoleRef.current = null;
    lastHoleRef.current = null;
    streakRef.current = 0;
    lockRef.current = false;
    playStateRef.current = 'playing';
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
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
  const kicker =
    playState === 'waiting'
      ? 'Press Start, then tap moles as they pop up'
      : playState === 'playing'
        ? 'Tap the moles the instant they peek out · 30 seconds on the clock'
        : '';

  return (
    <section className="game-wrap">
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className="puzzle-page whack-page">
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>Score</span>
              <strong>{score}</strong>
            </div>
            <div className={`puzzle-score${timeLeft <= 5 && playState === 'playing' ? ' is-urgent' : ''}`}>
              <span>Time</span>
              <strong>{playState === 'waiting' ? ROUND_SECONDS : timeLeft}</strong>
            </div>
            <div className="puzzle-score">
              <span>Best</span>
              <strong>{best}</strong>
            </div>
          </div>
          {playState === 'playing' ? (
            <button className="button button-pink puzzle-new" type="button" onClick={startGame}>
              Restart
            </button>
          ) : null}
        </div>

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
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
