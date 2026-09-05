import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Kids’ game arcade</p>
          <h1>
            Welcome to <span className="highlight">HighScoreHub</span>
          </h1>
          <p className="lede">
            Play fun games, save your scores, and climb the leaderboard. Flappy Bird is ready now — more games are on the way.
          </p>
          {user ? (
            <p className="welcome-pill">Hi {user.username}! Ready to beat your high score?</p>
          ) : (
            <p className="welcome-pill">Create a free account to save your high scores.</p>
          )}
          <div className="actions">
            <Link className="button button-play" to="/game">
              Play Flappy Bird
            </Link>
            {user ? (
              <Link className="button button-secondary" to="/leaderboard">
                High scores
              </Link>
            ) : null}
            {!user && (
              <Link className="button button-pink" to="/signup">
                Join HighScoreHub
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
        <h2>Games</h2>
        <div className="howto-grid">
          <article className="howto-card card-score">
            <span aria-hidden="true">🐦</span>
            <h3>Flappy Bird</h3>
            <p>Tap or press Space to flap. Dodge the pipes and rack up points.</p>
            <div className="actions">
              <Link className="button" to="/game">
                Play
              </Link>
            </div>
          </article>
          <article className="howto-card card-tap">
            <span aria-hidden="true">🎮</span>
            <h3>More games soon</h3>
            <p>New HighScoreHub games will land here. Stay tuned!</p>
          </article>
          <article className="howto-card card-dodge">
            <span aria-hidden="true">🏆</span>
            <h3>Leaderboard</h3>
            {user ? (
              <>
                <p>See who has the top scores and try to take first place.</p>
                <div className="actions">
                  <Link className="button button-secondary" to="/leaderboard">
                    View scores
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p>Sign in to see high scores and climb the board.</p>
                <div className="actions">
                  <Link className="button button-secondary" to="/signin" state={{ from: '/leaderboard' }}>
                    Sign in
                  </Link>
                </div>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="howto">
        <h2>How to play Flappy Bird</h2>
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
