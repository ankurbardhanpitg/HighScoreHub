import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SimonBoard from '../components/SimonBoard.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';
import { KEY_TO_PAD, PADS, extendSequence, playbackTiming } from '../game/simon.js';

const BEST_KEY = 'highscorehub-simon-best';
const PLAYER_FLASH_MS = 220;

function readBest() {
  const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function unlockAudio(audioRef) {
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
  } catch {
    // Ignore audio errors so a blocked sound never stops play.
  }
}

function playTone(audioRef, { freq, duration = 0.22, type = 'square', volume = 0.08 }) {
  try {
    unlockAudio(audioRef);
    const ctx = audioRef.current;
    if (!ctx) {
      return;
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
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

export default function GameSimon() {
  const { user } = useAuth();
  const [playState, setPlayState] = useState('waiting');
  const [phase, setPhase] = useState('watch');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(readBest);
  const [litPad, setLitPad] = useState(null);
  const [missPad, setMissPad] = useState(null);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const bestRef = useRef(best);
  const sequenceRef = useRef([]);
  const stepRef = useRef(0);
  const runIdRef = useRef(0);
  const flashIdRef = useRef(0);
  const timersRef = useRef([]);
  const audioRef = useRef(null);

  playStateRef.current = playState;
  phaseRef.current = phase;
  scoreRef.current = score;
  bestRef.current = best;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const later = useCallback((fn, delay) => {
    const id = window.setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const rememberBest = useCallback((nextScore) => {
    if (nextScore > bestRef.current) {
      bestRef.current = nextScore;
      setBest(nextScore);
      localStorage.setItem(BEST_KEY, String(nextScore));
    }
  }, []);

  const endGame = useCallback(() => {
    clearTimers();
    runIdRef.current += 1;
    playStateRef.current = 'ended';
    phaseRef.current = 'watch';
    setLitPad(null);
    setPlayState('ended');
    setPhase('watch');
    rememberBest(scoreRef.current);
  }, [clearTimers, rememberBest]);

  const playPadTone = useCallback((padId) => {
    const pad = PADS[padId];
    if (!pad) {
      return;
    }
    playTone(audioRef, { freq: pad.freq, duration: 0.24, type: 'square', volume: 0.08 });
  }, []);

  const playSequence = useCallback(
    (sequence, runId) => {
      const { onMs, gapMs } = playbackTiming(sequence.length);
      let elapsed = 360;

      sequence.forEach((padId, index) => {
        later(() => {
          if (runIdRef.current !== runId || playStateRef.current !== 'playing') {
            return;
          }
          setLitPad(padId);
          playPadTone(padId);
        }, elapsed);

        elapsed += onMs;

        later(() => {
          if (runIdRef.current !== runId) {
            return;
          }
          setLitPad(null);
        }, elapsed);

        if (index < sequence.length - 1) {
          elapsed += gapMs;
        }
      });

      later(() => {
        if (runIdRef.current !== runId || playStateRef.current !== 'playing') {
          return;
        }
        phaseRef.current = 'repeat';
        stepRef.current = 0;
        setPhase('repeat');
      }, elapsed + 180);
    },
    [later, playPadTone],
  );

  const beginRound = useCallback(
    (runId) => {
      if (runIdRef.current !== runId || playStateRef.current !== 'playing') {
        return;
      }
      const nextSequence = extendSequence(sequenceRef.current);
      sequenceRef.current = nextSequence;
      stepRef.current = 0;
      phaseRef.current = 'watch';
      setRound(nextSequence.length);
      setPhase('watch');
      setLitPad(null);
      setMissPad(null);
      playSequence(nextSequence, runId);
    },
    [playSequence],
  );

  const startGame = useCallback(() => {
    unlockAudio(audioRef);
    clearTimers();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    sequenceRef.current = [];
    stepRef.current = 0;
    scoreRef.current = 0;
    playStateRef.current = 'playing';
    phaseRef.current = 'watch';
    setScore(0);
    setRound(0);
    setLitPad(null);
    setMissPad(null);
    setPlayState('playing');
    setPhase('watch');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
    beginRound(runId);
  }, [beginRound, clearTimers]);

  const handlePlay = useCallback(
    (padId) => {
      if (playStateRef.current !== 'playing' || phaseRef.current !== 'repeat') {
        return;
      }

      const expected = sequenceRef.current[stepRef.current];
      flashIdRef.current += 1;
      const flashId = flashIdRef.current;
      setLitPad(padId);
      later(() => {
        if (flashIdRef.current === flashId) {
          setLitPad(null);
        }
      }, PLAYER_FLASH_MS);

      if (padId !== expected) {
        phaseRef.current = 'watch';
        setPhase('watch');
        setMissPad(padId);
        playTone(audioRef, { freq: 90, duration: 0.32, type: 'sawtooth', volume: 0.07 });
        later(endGame, 420);
        return;
      }

      playPadTone(padId);
      stepRef.current += 1;

      if (stepRef.current < sequenceRef.current.length) {
        return;
      }

      const nextScore = sequenceRef.current.length;
      scoreRef.current = nextScore;
      setScore(nextScore);
      rememberBest(nextScore);
      phaseRef.current = 'watch';
      setPhase('watch');

      const runId = runIdRef.current;
      const { betweenRoundsMs } = playbackTiming(nextScore);
      later(() => beginRound(runId), betweenRoundsMs);
    },
    [beginRound, endGame, later, playPadTone, rememberBest],
  );

  useEffect(() => {
    function onKeyDown(event) {
      if (event.repeat || playStateRef.current !== 'playing' || phaseRef.current !== 'repeat') {
        return;
      }
      if (event.key in KEY_TO_PAD) {
        event.preventDefault();
        handlePlay(KEY_TO_PAD[event.key]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePlay]);

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
      const saved = await submitScore(score, 'simon');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'ended';
  const playing = playState === 'playing';
  const boardLocked = overlayOpen || phase !== 'repeat';
  const kicker =
    playState === 'waiting'
      ? 'Press Start, watch the lights, then tap the same colors in order'
      : playState === 'playing'
        ? 'Watch the sequence, then repeat it · Q W A S or 1–4 also work'
        : '';

  let statusText = 'Watch';
  if (phase === 'repeat') {
    statusText = 'Your turn';
  }

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className={`puzzle-page simon-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>Round</span>
              <strong>{playing ? round : score}</strong>
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

        {playing ? (
          <p className="ttt-turn" aria-live="polite">
            {phase === 'watch' ? 'Watch the colors…' : 'Your turn — tap the sequence'}
          </p>
        ) : null}

        <div className="puzzle-stage simon-stage">
          <SimonBoard
            litPad={litPad}
            missPad={missPad}
            round={playing ? round : 0}
            statusText={playing ? statusText : 'Simon'}
            onPlay={handlePlay}
            disabled={boardLocked}
          />

          {playState === 'waiting' && (
            <div className="overlay" onClick={startGame}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>Watch the colored lights, then tap them back in the same order. Each round adds one more!</p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/simon" onClick={(event) => event.stopPropagation()}>
                    How to play
                  </Link>
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}

          {playState === 'ended' && (
            <div className="overlay">
              <div className={`panel overlay-panel${score >= 8 ? ' overlay-win' : ''}`}>
                <h2>{score >= 8 ? 'Memory star!' : score > 0 ? 'Nice try!' : 'Oops!'}</h2>
                <p className="final-score">You scored {score}!</p>
                <p>
                  {score >= 8
                    ? 'That’s a long sequence. Can you go even further?'
                    : 'One wrong color ends the round. Tap Play again and watch closely.'}
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
                      <Link className="button" to="/signin" state={{ from: '/game/simon' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/simon' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && savedAt && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Super memory!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={startGame}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=simon">
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
