import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GameSwitcher from '../components/GameSwitcher.jsx';
import Twenty48Board from '../components/Twenty48Board.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';
import { addRandomTile, canMove, createInitialTiles, moveTiles } from '../game/twenty48.js';

const BEST_KEY = 'highscorehub-2048-best';
const MOVE_MS = 160;
const KEY_TO_DIRECTION = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
  A: 'left',
  D: 'right',
  W: 'up',
  S: 'down',
};

function readBest() {
  const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export default function Game2048() {
  const { user } = useAuth();
  const [playState, setPlayState] = useState('waiting');
  const [tiles, setTiles] = useState([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [busy, setBusy] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const playStateRef = useRef(playState);
  const tilesRef = useRef(tiles);
  const scoreRef = useRef(score);
  const bestRef = useRef(best);
  const busyRef = useRef(busy);
  const hasWonRef = useRef(hasWon);
  const moveTimerRef = useRef(null);

  playStateRef.current = playState;
  tilesRef.current = tiles;
  scoreRef.current = score;
  bestRef.current = best;
  busyRef.current = busy;
  hasWonRef.current = hasWon;

  const startGame = useCallback(() => {
    if (moveTimerRef.current) {
      window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = null;
    }
    const initial = createInitialTiles();
    tilesRef.current = initial;
    scoreRef.current = 0;
    busyRef.current = false;
    hasWonRef.current = false;
    playStateRef.current = 'playing';
    setTiles(initial);
    setScore(0);
    setBusy(false);
    setHasWon(false);
    setPlayState('playing');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
  }, []);

  const handleMove = useCallback((direction) => {
    if (playStateRef.current !== 'playing' || busyRef.current) {
      return;
    }

    const result = moveTiles(tilesRef.current, direction);
    if (!result.moved) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    tilesRef.current = result.tiles;
    setTiles(result.tiles);

    const nextScore = scoreRef.current + result.scoreGained;
    scoreRef.current = nextScore;
    setScore(nextScore);

    if (nextScore > bestRef.current) {
      bestRef.current = nextScore;
      setBest(nextScore);
      localStorage.setItem(BEST_KEY, String(nextScore));
    }

    const showWin = result.reached2048 && !hasWonRef.current;

    moveTimerRef.current = window.setTimeout(() => {
      moveTimerRef.current = null;
      const cleaned = result.tiles
        .filter((tile) => !tile.removing)
        .map((tile) => ({ ...tile, isMerged: false, isNew: false }));
      const withSpawn = addRandomTile(cleaned);
      tilesRef.current = withSpawn;
      setTiles(withSpawn);

      if (showWin) {
        hasWonRef.current = true;
        setHasWon(true);
        playStateRef.current = 'won';
        setPlayState('won');
      } else if (!canMove(withSpawn)) {
        playStateRef.current = 'ended';
        setPlayState('ended');
      }

      busyRef.current = false;
      setBusy(false);
    }, MOVE_MS);
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction || playStateRef.current !== 'playing') {
        return;
      }
      event.preventDefault();
      handleMove(direction);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleMove]);

  useEffect(() => {
    return () => {
      if (moveTimerRef.current) {
        window.clearTimeout(moveTimerRef.current);
      }
    };
  }, []);

  function continueAfterWin() {
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
    playStateRef.current = 'playing';
    setPlayState('playing');
    if (!canMove(tilesRef.current)) {
      playStateRef.current = 'ended';
      setPlayState('ended');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || submitState === 'saving' || submitState === 'saved') {
      return;
    }

    setSubmitState('saving');
    setSubmitError('');

    try {
      const saved = await submitScore(score, '2048');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'won' || playState === 'ended';
  const kicker =
    playState === 'waiting'
      ? 'Press Start, then slide tiles to merge them'
      : playState === 'playing'
        ? 'Arrow keys, WASD, or swipe · merge tiles and chase a huge score'
        : '';

  return (
    <section className="game-wrap">
      <GameSwitcher />
      {kicker ? <p className="game-kicker">{kicker}</p> : null}

      <div className="puzzle-page">
        <div className="puzzle-hud">
          <div className="puzzle-scores">
            <div className="puzzle-score">
              <span>Score</span>
              <strong>{score}</strong>
            </div>
            <div className="puzzle-score">
              <span>Best</span>
              <strong>{best}</strong>
            </div>
          </div>
          <button className="button button-pink puzzle-new" type="button" onClick={startGame}>
            New game
          </button>
        </div>

        <div className="puzzle-stage">
          <Twenty48Board tiles={tiles} onMove={handleMove} disabled={overlayOpen || busy} />

          {playState === 'waiting' && (
            <div className="overlay" onClick={startGame}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>Slide tiles, merge matching numbers, and try to reach 2048 — then keep going.</p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                </div>
              </div>
            </div>
          )}

          {playState === 'won' && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>You made 2048!</h2>
                <p className="final-score">Score: {score}</p>
                <p>Keep sliding for a bigger high score, or save this run now.</p>
                <ScoreActions
                  user={user}
                  scorePath="/game/2048"
                  submitState={submitState}
                  submitError={submitError}
                  savedAt={savedAt}
                  onSubmit={handleSubmit}
                  successText="Saved on"
                />
                <div className="actions">
                  <button className="button button-play" type="button" onClick={continueAfterWin}>
                    Keep going
                  </button>
                  <button className="button button-secondary" type="button" onClick={startGame}>
                    New game
                  </button>
                </div>
              </div>
            </div>
          )}

          {playState === 'ended' && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>No more moves!</h2>
                <p className="final-score">You scored {score}!</p>
                <ScoreActions
                  user={user}
                  scorePath="/game/2048"
                  submitState={submitState}
                  submitError={submitError}
                  savedAt={savedAt}
                  onSubmit={handleSubmit}
                  successText="Saved on"
                />
                <div className="actions">
                  <button className="button button-play" type="button" onClick={startGame}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=2048">
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

function ScoreActions({ user, scorePath, submitState, submitError, savedAt, onSubmit, successText }) {
  return (
    <>
      {user ? (
        <form onSubmit={onSubmit} className="score-form">
          <p>Save this score as {user.username}?</p>
          <button className="button" type="submit" disabled={submitState === 'saving' || submitState === 'saved'}>
            {submitState === 'saved' ? 'Score saved!' : submitState === 'saving' ? 'Saving...' : 'Save my score'}
          </button>
        </form>
      ) : (
        <div className="score-form">
          <p>Sign in to put this score on the board.</p>
          <div className="actions">
            <Link className="button" to="/signin" state={{ from: scorePath }}>
              Sign in
            </Link>
            <Link className="button button-pink" to="/signup" state={{ from: scorePath }}>
              Join in
            </Link>
          </div>
        </div>
      )}
      {submitError && <p className="error">{submitError}</p>}
      {submitState === 'saved' && savedAt && (
        <p className="success">
          {successText} {formatScoreDate(savedAt)}. Nice merge!
        </p>
      )}
    </>
  );
}
