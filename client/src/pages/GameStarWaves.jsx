import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StarWavesContainer from '../components/StarWavesContainer.jsx';
import QuitGameButton, { GamePlayFabs } from '../components/QuitGameButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScore } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

export default function GameStarWaves() {
  const { user } = useAuth();
  const gameRef = useRef(null);
  const [gameKey, setGameKey] = useState(0);
  const [playState, setPlayState] = useState('waiting');
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const handleGameOver = useCallback((finalScore, finalWave = 1) => {
    setScore(finalScore);
    setWave(finalWave);
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
    setWave(1);
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
      const saved = await submitScore(score, 'starwaves');
      setSavedAt(saved.createdAt);
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Could not submit score');
    }
  }

  const kicker =
    playState === 'waiting'
      ? 'Press Start, then move your ship and blast the star blobs'
      : playState === 'paused'
        ? 'Game paused — press Resume to keep defending'
        : playState === 'playing'
          ? 'Move with the mouse, a finger, or arrows · tap or Space to shoot · P or Esc to pause'
          : '';

  return (
    <section className="game-wrap">
      {kicker ? <p className="game-kicker">{kicker}</p> : null}
      <div className="game-page">
        <div className="game-stage starwaves-stage">
          <StarWavesContainer
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
                  Slide your ship along the bottom. Tap or press Space to send a star shot. Clear each wave before the
                  blobs reach you!
                </p>
                <div className="actions">
                  <button className="button button-play" type="button">
                    Start
                  </button>
                  <Link className="button button-secondary" to="/howto/starwaves" onClick={(event) => event.stopPropagation()}>
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
                <p>The star blobs will wait right here.</p>
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
                <h2>Nice blasting!</h2>
                <p className="final-score">You scored {score}!</p>
                <p>You reached wave {wave}. Want to chase an even bigger star score?</p>

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
                      <Link className="button" to="/signin" state={{ from: '/game/starwaves' }}>
                        Sign in
                      </Link>
                      <Link className="button button-pink" to="/signup" state={{ from: '/game/starwaves' }}>
                        Sign up
                      </Link>
                    </div>
                  </div>
                )}

                {submitError && <p className="error">{submitError}</p>}
                {submitState === 'saved' && (
                  <p className="success">Saved on {formatScoreDate(savedAt)}. Super shooting!</p>
                )}
                <div className="actions">
                  <button className="button button-play" type="button" onClick={playAgain}>
                    Play again
                  </button>
                  {user ? (
                    <Link className="button button-secondary" to="/leaderboard?game=starwaves">
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
