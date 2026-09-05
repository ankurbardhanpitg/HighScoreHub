import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';

export default function App() {
  const { user, ready, signout } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Flappy Bird
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/game">Play</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          {ready && user ? (
            <span className="nav-user">
              <span>{user.username}</span>
              <button className="nav-signout" type="button" onClick={signout}>
                Sign out
              </button>
            </span>
          ) : (
            <>
              <NavLink to="/signin">Sign in</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
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
    </div>
  );
}
