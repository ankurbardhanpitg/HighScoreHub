import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DinoRunnerContainer from '../components/DinoRunnerContainer.jsx';
import QuitGameButton, { GamePlayFabs } from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGameExpand } from '../hooks/useGameExpand.js';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

export default function GameDino() {
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
      const saved = await submitScore(score, 'dino');
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
          ? 'Tap or hold Space to jump · 3 lives · stay low for high birds · P or Esc to pause'
          : '';

  return (
    <section className={`game-wrap${isExpanded ? ' is-expanded' : ''}`}>
      {kicker ? <p className="game-kicker">{kicker}</p> : null}
      <div className={`game-page${isExpanded ? ' is-expanded' : ''}`}>
        <div className="game-stage dino-stage">
          <DinoRunnerContainer
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
                <p>You have 3 lives. Jump over cacti, stay low for high pterodactyls, and clear 20 obstacles to level up. You only jump from the ground — mash clicking will not keep you in the air!</p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/dino" onClick={(event) => event.stopPropagation()}>
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
                <p>Take a breath. The dino will wait right here.</p>
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
                <h2>{won ? 'You win!' : 'Oh no!'}</h2>
                <p className="final-score">You scored {score}!</p>
                <p>
                  {won
                    ? 'You cleared all 5 levels. What a run!'
                    : `You reached level ${level} and used all 3 lives. Want to try again?`}
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
                      <Link className="button" to="/signin" state={{ from: '/game/dino' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/dino' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Nice running!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={playAgain}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=dino">
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
