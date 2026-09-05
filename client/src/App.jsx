import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import SkyDecor from './components/SkyDecor.jsx';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';

export default function App() {
  const { user, ready, signout } = useAuth();

  return (
    <div className="app">
      <SkyDecor />
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            🐦
          </span>
          Flappy Bird
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/game">Play</NavLink>
          <NavLink to="/leaderboard">Scores</NavLink>
          {ready && user ? (
            <span className="nav-user">
              <span className="user-chip" aria-hidden="true">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="user-name">{user.username}</span>
              <button className="nav-signout" type="button" onClick={signout}>
                Sign out
              </button>
            </span>
          ) : (
            <>
              <NavLink to="/signin">Sign in</NavLink>
              <NavLink to="/signup">Join in</NavLink>
            </>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </main>
      <footer className="site-footer">Made for little flyers and big smiles</footer>
    </div>
  );
}
