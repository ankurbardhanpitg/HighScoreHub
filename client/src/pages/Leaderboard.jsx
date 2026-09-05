import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTopScores } from '../api.js';

export default function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setError('');

      try {
        const data = await fetchTopScores();
        if (!cancelled) {
          setScores(data);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setStatus('error');
          setError(loadError.message || 'Could not load leaderboard');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel">
      <h1>Leaderboard</h1>
      <p>Top 10 scores</p>

      {status === 'loading' && <p>Loading scores...</p>}
      {status === 'error' && <p className="error">{error}</p>}

      {status === 'ready' && scores.length === 0 && <p>No scores yet. Be the first to play.</p>}

      {status === 'ready' && scores.length > 0 && (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((entry, index) => (
              <tr key={entry._id || `${entry.playerName}-${index}`}>
                <td>{index + 1}</td>
                <td>{entry.playerName}</td>
                <td>{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="actions">
        <Link className="button" to="/game">
          Play
        </Link>
        <Link className="button button-secondary" to="/">
          Home
        </Link>
      </div>
    </section>
  );
}
