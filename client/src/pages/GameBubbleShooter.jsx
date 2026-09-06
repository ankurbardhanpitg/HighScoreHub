import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BubbleShooterContainer from '../components/BubbleShooterContainer.jsx';
import QuitGameButton, { GamePlayFabs } from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

export default function GameBubbleShooter() {
  const { user } = useAuth();
  const gameRef = useRef(null);
  const [gameKey, setGameKey] = useState(0);
  const [playState, setPlayState] = useState('waiting');
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const handleGameOver = useCallback((finalScore, finalLevel = 1) => {
    setScore(finalScore);
    setLevel(finalLevel);
    setIsGameOver(true);
    setPlayState('ended');
    setSubmitState('idle');
    setSubmitError('');
    setSavedAt('');
  }, []);

  function playAgain() {
    setIsGameOver(false);
    setPlayState('waiting');
    setScore(0);
    setLevel(1);
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
      const saved = await submitScore(score, 'bubble');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const kicker =
    playState === 'waiting'
      ? 'Press Start, then aim and pop matching bubbles'
      : playState === 'paused'
        ? 'Game paused — press Resume to keep popping'
        : playState === 'playing'
          ? 'Aim with the mouse, a finger, or arrows · tap or Space to shoot · P or Esc to pause'
          : '';

  return (
    <section className="game-wrap">
      {kicker ? <p className="game-kicker">{kicker}</p> : null}
      <div className="game-page bubble-game-page">
        <div className="game-stage bubble-stage">
          <BubbleShooterContainer
            key={gameKey}
            ref={gameRef}
            onGameOver={handleGameOver}
            onStateChange={setPlayState}
          />

          {playState === 'playing' && <GamePlayFabs onPause={() => gameRef.current?.pause()} />}

          {playState === 'waiting' && (
            <div className="overlay" onClick={() => gameRef.current?.start()}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>
                  Aim the cannon and shoot. Match 2 or more bubbles of the same color to pop them. Don’t let the cluster
                  reach the pink line!
                </p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/bubble" onClick={(event) => event.stopPropagation()}>
                    How to play
                  </Link>
                  <QuitGameButton />
                </div>
              </div>
            </div>
          )}

          {playState === 'paused' && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>Paused</h2>
                <p>The bubbles will wait right here.</p>
                <div className="actions">
                  <button className="button button-play" type="button" onClick={() => gameRef.current?.resume()}>
                    Resume
                  </button>
                  <QuitGameButton />
                </div>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>Nice popping!</h2>
                <p className="final-score">You scored {score}!</p>
                <p>You reached level {level}. Want to try for an even bigger bubble score?</p>

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
                      <Link className="button" to="/signin" state={{ from: '/game/bubble' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/bubble' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Super shots!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={playAgain}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=bubble">
                      High scores
                    </Link>
                  ) : null}
                  <QuitGameButton />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
