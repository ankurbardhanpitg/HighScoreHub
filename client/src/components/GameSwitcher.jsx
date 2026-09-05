import { NavLink } from 'react-router-dom';
import { GAMES } from '../game/games.js';

export default function GameSwitcher() {
  return (
    <div className="game-switcher" role="navigation" aria-label="Choose a game">
      {GAMES.map((game) => (
        <NavLink key={game.id} to={game.path} end className="game-switcher-link">
          <span aria-hidden="true">{game.emoji}</span>
          {game.name}
        </NavLink>
      ))}
    </div>
  );
}
