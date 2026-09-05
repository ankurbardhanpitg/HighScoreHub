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
            Play fun games, save your scores, and climb the leaderboard. Flappy Bird and 2048 are ready — more games are on the way.
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
            <Link className="button button-pink" to="/game/2048">
              Play 2048
            </Link>
            {user ? (
              <Link className="button button-secondary" to="/leaderboard">
                High scores
              </Link>
            ) : null}
            {!user && (
              <Link className="button" to="/signup">
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
          <article className="howto-card card-merge">
            <span aria-hidden="true">🔢</span>
            <h3>2048</h3>
            <p>Slide tiles, merge matching numbers, and chase a huge high score.</p>
            <div className="actions">
              <Link className="button" to="/game/2048">
                Play
              </Link>
            </div>
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

      <section className="howto">
        <h2>How to play 2048</h2>
        <div className="howto-grid">
          <article className="howto-card card-tap">
            <span aria-hidden="true">➡️</span>
            <h3>Slide the grid</h3>
            <p>Use arrow keys, WASD, or a swipe to move every tile.</p>
          </article>
          <article className="howto-card card-merge">
            <span aria-hidden="true">➕</span>
            <h3>Merge matches</h3>
            <p>When two tiles with the same number meet, they become one bigger tile.</p>
          </article>
          <article className="howto-card card-score">
            <span aria-hidden="true">🎯</span>
            <h3>Chase 2048</h3>
            <p>Reach 2048, then keep going. Every merge adds to your score.</p>
          </article>
        </div>
      </section>
    </>
  );
}
