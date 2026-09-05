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
            Play fun games, save your scores, and climb the leaderboard. Flappy Bird, 2048, Whack-a-Mole, Pong, and Breakout are ready to play.
          </p>
          {user ? (
            <p className="welcome-pill">Hi {user.username}! Ready to beat your high score?</p>
          ) : (
            <p className="welcome-pill">Create a free account to save your high scores.</p>
          )}
          <div className="actions">
            <Link className="button button-play" to="/games">
              Games
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
          <img
            className="hero-logo"
            src="/HighScoreHubLogo.png"
            alt="HighScoreHub"
            width="320"
            height="320"
          />
        </div>
      </section>
    </>
  );
}
