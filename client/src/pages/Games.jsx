import { Link } from 'react-router-dom';
import { GAMES } from '../game/games.js';

export default function Games() {
  return (
    <section className="howto howto-page games-page">
      <p className="eyebrow">Pick a game</p>
      <h1>Games</h1>
      <p className="lede">Choose a game to play, or open How to play if you want a quick recap first.</p>

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
  );
}
