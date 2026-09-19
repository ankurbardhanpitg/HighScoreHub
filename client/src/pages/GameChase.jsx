import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ChaseContainer from '../components/ChaseContainer.jsx';
import QuitGameButton, { GamePlayFabs } from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

export default function GameChase() {
  const { user } = useAuth();
  const gameRef = useRef(null);
  const [gameKey, setGameKey] = useState(0);
  const [playState, setPlayState] = useState('waiting');
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [won, setWon] = useState(false);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const handleGameOver = useCallback((finalScore, finalLevel = 1, didWin = false) => {
    setScore(finalScore);
    setLevel(finalLevel);
    setWon(didWin);
    setIsGameOver(true);
    setPlayState('ended');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
  }, []);

  const { isExpanded, handleQuit } = useGameExpand({
    playState,
    isGameOver,
    onPause: () => gameRef.current?.pause(),
  });

  function playAgain() {
    setIsGameOver(false);
    setPlayState('waiting');
    setScore(0);
    setLevel(1);
    setWon(false);
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
    setGameKey((value) => value + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || submitState === 'saving' || submitState === 'saved') {
      return;
    }

    setSubmitState('saving');
    setSubmitError('');

    try {
      const saved = await submitScore(score, 'chase');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const kicker =
    playState === 'waiting'
      ? 'Press Start when you are ready'
      : playState === 'paused'
        ? 'Game paused — press Resume to keep running'
        : playState === 'playing'
          ? 'Move with the mouse, a finger, or arrows · grab stars · don’t get tagged · P or Esc to pause'
          : '';

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}
      <div className={`game-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="game-stage chase-stage">
          <ChaseContainer
            key={gameKey}
            ref={gameRef}
            onGameOver={handleGameOver}
            onStateChange={setPlayState}
          />

          {playState === 'playing' && (
            <GamePlayFabs onPause={() => gameRef.current?.pause()} onQuit={handleQuit} />
          )}

          {playState === 'waiting' && (
            <div className="overlay" onClick={() => gameRef.current?.start()}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>
                  Grab every star before the chasers tag you. You have 3 lives. A new chaser joins every level. Clear all 10 levels to win!
                </p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/chase" onClick={(event) => event.stopPropagation()}>
                    How to play
                  </Link>
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}

          {playState === 'paused' && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>Paused</h2>
                <p>The chasers will wait right here.</p>
                <div className="actions">
                  <button className="button button-play" type="button" onClick={() => gameRef.current?.resume()}>
                    Resume
                  </button>
                  <QuitGameButton onClick={handleQuit} />
                </div>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="overlay">
              <div className={`panel overlay-panel${won ? ' overlay-win' : ''}`}>
                <h2>{won ? 'You win!' : 'Tagged!'}</h2>
                <p className="final-score">You scored {score}!</p>
                <p>
                  {won
                    ? 'You grabbed every star and escaped all 10 levels. Fast feet!'
                    : `You reached level ${level}. Want to try to stay ahead a little longer?`}
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
                      <Link className="button" to="/signin" state={{ from: '/game/chase' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/chase' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Nice chase!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={playAgain}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=chase">
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
