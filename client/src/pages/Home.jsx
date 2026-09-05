import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { GAMES } from '../game/games.js';

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
            Play fun games, save your scores, and climb the leaderboard. Flappy Bird, 2048, Whack-a-Mole, and Pong are ready to play.
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
            <Link className="button button-grass" to="/game/whack">
              Play Whack-a-Mole
            </Link>
            <Link className="button button-purple" to="/game/pong">
              Play Pong
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
        <div className="howto-grid games-grid">
          {GAMES.map((game) => (
            <article key={game.id} className={`howto-card ${game.cardClass}`}>
              <span aria-hidden="true">{game.emoji}</span>
              <h3>{game.name}</h3>
              <p>{game.blurb}</p>
              <div className="actions">
                <Link className="button" to={game.path}>
                  Play
                </Link>
                <Link className="button button-secondary" to={game.howToPath}>
                  How to play
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
