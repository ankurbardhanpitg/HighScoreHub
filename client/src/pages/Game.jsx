import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GameContainer from '../components/GameContainer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

export default function Game() {
  const { user } = useAuth();
  const gameRef = useRef(null);
  const [gameKey, setGameKey] = useState(0);
  const [playState, setPlayState] = useState('waiting');
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const handleGameOver = useCallback((finalScore) => {
    setScore(finalScore);
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
      const saved = await submitScore(score);
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
        ? 'Game paused — press Resume to keep flying'
        : playState === 'playing'
          ? 'Tap the game or press Space to flap · P or Esc to pause'
          : '';

  return (
    <section className="game-wrap">
      {kicker ? <p className="game-kicker">{kicker}</p> : null}
      <div className="game-page">
        <div className="game-stage">
          <GameContainer
            key={gameKey}
            ref={gameRef}
            onGameOver={handleGameOver}
            onStateChange={setPlayState}
          />

          {playState === 'playing' && (
            <button className="button button-pink pause-fab" type="button" onClick={() => gameRef.current?.pause()}>
              Pause
            </button>
          )}

          {playState === 'waiting' && (
            <div className="overlay" onClick={() => gameRef.current?.start()}>
              <div className="panel overlay-panel">
                <h2>Ready?</h2>
                <p>Tap Start, then flap to fly through the pipes.</p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                </div>
              </div>
            </div>
          )}

          {playState === 'paused' && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>Paused</h2>
                <p>Take a breath. The bird will wait right here.</p>
                <div className="actions">
                  <button className="button button-play" type="button" onClick={() => gameRef.current?.resume()}>
                    Resume
                  </button>
                </div>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="overlay">
              <div className="panel overlay-panel">
                <h2>Oh no!</h2>
                <p className="final-score">You scored {score}!</p>

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
                      <Link className="button" to="/signin" state={{ from: '/game' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game' }}>
                        Join in
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Nice flying!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={playAgain}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard">
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
