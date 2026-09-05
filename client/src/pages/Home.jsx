import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <section className="panel home-panel">
      <h1>Flappy Bird</h1>
      <p>Tap or press Space to flap. Avoid the pipes and post your score.</p>
      {user ? <p>Signed in as {user.username}.</p> : <p>Sign up to save your best scores.</p>}
      <div className="actions">
        <Link className="button" to="/game">
          Play
        </Link>
        <Link className="button button-secondary" to="/leaderboard">
          Leaderboard
        </Link>
        {!user && (
          <>
            <Link className="button button-secondary" to="/signin">
              Sign in
            </Link>
            <Link className="button button-secondary" to="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
