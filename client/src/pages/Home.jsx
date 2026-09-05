import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">A sunny sky adventure</p>
          <h1>
            Tap, flap, <span className="highlight">fly!</span>
          </h1>
          <p className="lede">
            Help the little bird zip through the pipes. Easy to learn, fun to play, and perfect for kids.
          </p>
          {user ? (
            <p className="welcome-pill">Hi {user.username}! Ready for another flight?</p>
          ) : (
            <p className="welcome-pill">Create a free account to save your high scores.</p>
          )}
          <div className="actions">
            <Link className="button button-play" to="/game">
              Play now
            </Link>
            <Link className="button button-secondary" to="/leaderboard">
              High scores
            </Link>
            {!user && (
              <Link className="button button-pink" to="/signup">
                Join the flock
              </Link>
            )}
          </div>
        </div>
        <div className="mascot-wrap">
          <div className="mascot" aria-hidden="true">
            <div className="mascot-wing" />
            <div className="mascot-body" />
            <div className="mascot-belly" />
            <div className="mascot-eye" />
            <div className="mascot-beak" />
          </div>
        </div>
      </section>

      <section className="howto">
        <h2>How to play</h2>
        <div className="howto-grid">
          <article className="howto-card card-tap">
            <span aria-hidden="true">👆</span>
            <h3>Tap or Space</h3>
            <p>Give the bird a flap whenever it starts to fall.</p>
          </article>
          <article className="howto-card card-dodge">
            <span aria-hidden="true">🌿</span>
            <h3>Dodge pipes</h3>
            <p>Fly through the green openings. Don’t bump the edges!</p>
          </article>
          <article className="howto-card card-score">
            <span aria-hidden="true">⭐</span>
            <h3>Score points</h3>
            <p>Each pipe you pass is a point. Beat your friends!</p>
          </article>
        </div>
      </section>
    </>
  );
}
