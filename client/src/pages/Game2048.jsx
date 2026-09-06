import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Twenty48Board from '../components/Twenty48Board.jsx';
import QuitGameButton from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';
import { addRandomTile, canMove, createInitialTiles, moveTiles } from '../game/twenty48.js';
import { createTwenty48Audio } from '../game/twenty48Audio.js';

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
  const [savedScore, setSavedScore] = useState(null);
  const [endedReason, setEndedReason] = useState('stuck');

  const playStateRef = useRef(playState);
  const tilesRef = useRef(tiles);
  const scoreRef = useRef(score);
  const bestRef = useRef(best);
  const busyRef = useRef(busy);
  const hasWonRef = useRef(hasWon);
  const moveTimerRef = useRef(null);
  const audioRef = useRef(null);

  function audio() {
    if (!audioRef.current) {
      audioRef.current = createTwenty48Audio();
    }
    return audioRef.current;
  }

  playStateRef.current = playState;
  tilesRef.current = tiles;
  scoreRef.current = score;
  bestRef.current = best;
  busyRef.current = busy;
  hasWonRef.current = hasWon;

  const startGame = useCallback(() => {
    audio().unlock();
    audio().start();
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
    setSavedScore(null);
  }, []);

  const handleMove = useCallback((direction) => {
    if (playStateRef.current !== 'playing' || busyRef.current) {
      return;
    }

    const result = moveTiles(tilesRef.current, direction);
    if (!result.moved) {
      return;
    }

    const mergedTiles = result.tiles.filter((tile) => tile.isMerged);
    if (mergedTiles.length > 0) {
      const highest = mergedTiles.reduce((max, tile) => Math.max(max, tile.value), 0);
      audio().merge(highest);
    } else {
      audio().slide();
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
        audio().win();
        hasWonRef.current = true;
        setHasWon(true);
        playStateRef.current = 'won';
        setPlayState('won');
      } else if (!canMove(withSpawn)) {
        audio().lose();
        playStateRef.current = 'ended';
        setEndedReason('stuck');
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
    playStateRef.current = 'playing';
    setPlayState('playing');
    if (!canMove(tilesRef.current)) {
      audio().lose();
      playStateRef.current = 'ended';
      setEndedReason('stuck');
      setPlayState('ended');
    }
  }

  function endRun() {
    if (playStateRef.current !== 'playing' && playStateRef.current !== 'won') {
      return;
    }
    audio().end();
    playStateRef.current = 'ended';
    setEndedReason('finished');
    setPlayState('ended');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const currentScore = scoreRef.current;
    if (!user || currentScore <= 0 || submitState === 'saving' || (submitState === 'saved' && savedScore === currentScore)) {
      return;
    }

    setSubmitState('saving');
    setSubmitError('');

    try {
      const saved = await submitScore(currentScore, '2048');
      setSavedAt(saved.createdAt);
      setSavedScore(currentScore);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const overlayOpen = playState === 'waiting' || playState === 'won' || playState === 'ended';
  const alreadySaved = submitState === 'saved' && savedScore === score;
  const kicker =
    playState === 'waiting'
      ? 'Press Start, then slide tiles to merge them'
      : playState === 'playing'
        ? 'Arrow keys, WASD, or swipe · save your score under the board whenever you like'
        : '';

  return (
    <section className="game-wrap">
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
          <div className="puzzle-hud-actions">
            {playState === 'playing' || playState === 'won' ? (
              <button className="button button-secondary puzzle-new" type="button" onClick={endRun} disabled={score <= 0}>
                End run
              </button>
            ) : null}
            <button className="button button-pink puzzle-new" type="button" onClick={startGame}>
              New game
            </button>
            <QuitGameButton className="button button-secondary puzzle-new" />
          </div>
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
                  <Link className="button button-secondary" to="/howto/2048" onClick={(event) => event.stopPropagation()}>
                    How to play
                  </Link>
                  <QuitGameButton />
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
                  score={score}
                  scorePath="/game/2048"
                  submitState={submitState}
                  submitError={submitError}
                  savedAt={savedAt}
                  alreadySaved={alreadySaved}
                  onSubmit={handleSubmit}
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
                <h2>{endedReason === 'finished' ? 'Run finished!' : 'No more moves!'}</h2>
                <p className="final-score">You scored {score}!</p>
                <ScoreActions
                  user={user}
                  score={score}
                  scorePath="/game/2048"
                  submitState={submitState}
                  submitError={submitError}
                  savedAt={savedAt}
                  alreadySaved={alreadySaved}
                  onSubmit={handleSubmit}
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
                  <QuitGameButton />
                </div>
              </div>
            </div>
          )}
        </div>

        {playState !== 'waiting' ? (
          <div className="puzzle-save">
            <h3>Save this score</h3>
            <p className="final-score puzzle-save-score">{score}</p>
            <ScoreActions
              user={user}
              score={score}
              scorePath="/game/2048"
              submitState={submitState}
              submitError={submitError}
              savedAt={savedAt}
              alreadySaved={alreadySaved}
              onSubmit={handleSubmit}
            />
            {user ? (
              <div className="actions">
                <Link className="button button-secondary" to="/leaderboard?game=2048">
                  High scores
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ScoreActions({
  user,
  score,
  scorePath,
  submitState,
  submitError,
  savedAt,
  alreadySaved,
  onSubmit,
}) {
  const saveDisabled = submitState === 'saving' || alreadySaved || score <= 0;

  return (
    <>
      {user ? (
        <form onSubmit={onSubmit} className="score-form">
          <p>
            {score <= 0
              ? 'Merge tiles to earn a score, then save it here.'
              : alreadySaved
                ? `Saved ${score} as ${user.username}. Keep going to beat it!`
                : `Save ${score} as ${user.username}?`}
          </p>
          <button className="button" type="submit" disabled={saveDisabled}>
            {alreadySaved ? 'Score saved!' : submitState === 'saving' ? 'Saving...' : 'Save my score'}
          </button>
        </form>
      ) : (
        <div className="score-form">
          <p>Sign in to put this score on the 2048 board.</p>
          <div className="actions">
            <Link className="button" to="/signin" state={{ from: scorePath }}>
              Sign in
            </Link>
            <Link className="button button-pink" to="/signup" state={{ from: scorePath }}>
              Sign up
            </Link>
          </div>
        </div>
      )}
      {submitError && <p className="error">{submitError}</p>}
      {alreadySaved && savedAt && (
        <p className="success">Saved on {formatScoreDate(savedAt)}. Nice merge!</p>
      )}
    </>
  );
}
