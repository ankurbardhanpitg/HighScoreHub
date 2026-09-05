import { Link, Navigate, useParams } from 'react-router-dom';
import { getGame } from '../game/games.js';

export default function HowTo() {
  const { gameId } = useParams();
  const game = getGame(gameId);

  if (!game) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="howto howto-page">
      <p className="eyebrow">How to play</p>
      <h1>
        <span aria-hidden="true">{game.emoji}</span> {game.name}
      </h1>
      <p className="lede">{game.blurb}</p>

      <ol className="howto-grid howto-steps">
        {game.steps.map((step, index) => (
          <li key={step.title} className={`howto-card ${step.cardClass}`}>
            <span className="howto-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span aria-hidden="true">{step.emoji}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="actions howto-page-actions">
        <Link className="button button-play" to={game.path}>
          Play {game.shortName}
        </Link>
        <Link className="button button-secondary" to="/games">
          Games
        </Link>
      </div>
    </section>
  );
}
