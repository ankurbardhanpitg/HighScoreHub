import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import SkyDecor from './components/SkyDecor.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Home from './pages/Home.jsx';
import Games from './pages/Games.jsx';
import Game from './pages/Game.jsx';
import Game2048 from './pages/Game2048.jsx';
import GameWhack from './pages/GameWhack.jsx';
import GamePong from './pages/GamePong.jsx';
import GameBreakout from './pages/GameBreakout.jsx';
import GameStarWaves from './pages/GameStarWaves.jsx';
import GameBubbleShooter from './pages/GameBubbleShooter.jsx';
import GameSnake from './pages/GameSnake.jsx';
import HowTo from './pages/HowTo.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';

function isGamesNavActive(pathname) {
  return pathname === '/games' || pathname.startsWith('/game') || pathname.startsWith('/howto');
}

export default function App() {
  const { user, ready, signout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="app">
      <SkyDecor />
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="brand-logo" src="/HighScoreHubLogo.png" alt="" width="52" height="52" />
          HighScoreHub
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/games" className={() => (isGamesNavActive(pathname) ? 'active' : undefined)}>
            Games
          </NavLink>
          {ready && user ? <NavLink to="/leaderboard">Scores</NavLink> : null}
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
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Games />} />
          <Route path="/howto/:gameId" element={<HowTo />} />
          <Route path="/game" element={<Game />} />
          <Route path="/game/2048" element={<Game2048 />} />
          <Route path="/game/whack" element={<GameWhack />} />
          <Route path="/game/pong" element={<GamePong />} />
          <Route path="/game/breakout" element={<GameBreakout />} />
          <Route path="/game/starwaves" element={<GameStarWaves />} />
          <Route path="/game/bubble" element={<GameBubbleShooter />} />
          <Route path="/game/snake" element={<GameSnake />} />
          <Route
            path="/leaderboard"
            element={
              <RequireAuth>
                <Leaderboard />
              </RequireAuth>
            }
          />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </main>
      <footer className="site-footer">HighScoreHub — play games, beat high scores</footer>
    </div>
  );
}
