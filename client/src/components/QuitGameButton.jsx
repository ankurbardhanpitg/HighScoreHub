import { Link } from 'react-router-dom';

export default function QuitGameButton({ className = 'button button-secondary' }) {
  return (
    <Link className={className} to="/games" onClick={(event) => event.stopPropagation()}>
      Quit
    </Link>
  );
}

export function GamePlayFabs({ onPause }) {
  return (
    <div className="game-fabs">
      <button className="button button-pink" type="button" onClick={onPause}>
        Pause
      </button>
      <QuitGameButton />
    </div>
  );
}
