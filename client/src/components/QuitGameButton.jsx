import { Link } from 'react-router-dom';

export default function QuitGameButton({ className = 'button button-secondary', onClick }) {
  return (
    <Link
      className={className}
      to="/games"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    >
      Quit
    </Link>
  );
}

export function GamePlayFabs({ onPause, onQuit }) {
  return (
    <div className="game-fabs">
      <button className="button button-pink" type="button" onClick={onPause}>
        Pause
      </button>
      <QuitGameButton onClick={onQuit} />
    </div>
  );
}
