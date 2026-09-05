import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import GameContainer from '../components/GameContainer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';

export default function Game() {
  const { user } = useAuth();
  const [gameKey, setGameKey] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');

  const handleGameOver = useCallback((finalScore) => {
    setScore(finalScore);
    setIsGameOver(true);
    setSubmitState('idle');
    setSubmitError('');
  }, []);

  function playAgain() {
    setIsGameOver(false);
    setScore(0);
    setSubmitState('idle');
    setSubmitError('');
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
      await submitScore(score);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  return (
    <section className="game-page">
      <GameContainer key={gameKey} onGameOver={handleGameOver} />

      {isGameOver && (
        <div className="overlay">
          <div className="panel overlay-panel">
            <h2>Game Over</h2>
            <p className="final-score">Score: {score}</p>

            {user ? (
              <form onSubmit={handleSubmit} className="score-form">
                <p>Saving as {user.username}</p>
                <button className="button" type="submit" disabled={submitState === 'saving' || submitState === 'saved'}>
                  {submitState === 'saved' ? 'Submitted' : submitState === 'saving' ? 'Submitting...' : 'Submit'}
                </button>
              </form>
            ) : (
              <div className="score-form">
                <p>Sign in to save this score to the leaderboard.</p>
                <div className="actions">
                  <Link className="button" to="/signin" state={{ from: '/game' }}>
                    Sign in
                  </Link>
                  <Link className="button button-secondary" to="/signup" state={{ from: '/game' }}>
                    Sign up
                  </Link>
                </div>
              </div>
            )}

            {submitError && <p className="error">{submitError}</p>}
            {submitState === 'saved' && <p className="success">Score saved to the leaderboard.</p>}
            <div className="actions">
              <button className="button" type="button" onClick={playAgain}>
                Play Again
              </button>
              <Link className="button button-secondary" to="/leaderboard">
                View Leaderboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
