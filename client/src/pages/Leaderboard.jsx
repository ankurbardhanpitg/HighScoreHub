import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTopScores } from '../api.js';
import { formatScoreDate } from '../formatDate.js';

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;
const LIMIT_PRESETS = [5, 10, 20, 50];

function clampLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

export default function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [limitInput, setLimitInput] = useState(String(DEFAULT_LIMIT));
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  function applyLimit(nextLimit) {
    const safeLimit = clampLimit(nextLimit);
    setLimitInput(String(safeLimit));
    if (safeLimit === limit) {
      return;
    }
    setLimit(safeLimit);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setError('');

      try {
        const data = await fetchTopScores(page, limit);
        if (!cancelled) {
          setScores(data.scores);
          setPage(data.page);
          setLimit(data.limit);
          setLimitInput(String(data.limit));
          setTotalPages(data.totalPages);
          setTotal(data.total);
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
  }, [page, limit]);

  const rankStart = (page - 1) * limit;

  return (
    <section className="panel leaderboard-panel">
      <h1>Leaderboard</h1>
      <p>Newest scores first, {limit} per page</p>

      <div className="page-size">
        <label htmlFor="leaderboard-limit-preset">Scores per page</label>
        <select
          id="leaderboard-limit-preset"
          value={LIMIT_PRESETS.includes(limit) ? String(limit) : 'custom'}
          onChange={(event) => {
            if (event.target.value !== 'custom') {
              applyLimit(event.target.value);
            }
          }}
        >
          {LIMIT_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
          {!LIMIT_PRESETS.includes(limit) && <option value="custom">Custom</option>}
        </select>
        <label className="sr-only" htmlFor="leaderboard-limit">
          Custom limit
        </label>
        <input
          id="leaderboard-limit"
          type="number"
          min={MIN_LIMIT}
          max={MAX_LIMIT}
          value={limitInput}
          onChange={(event) => setLimitInput(event.target.value)}
          onBlur={() => applyLimit(limitInput)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              applyLimit(limitInput);
            }
          }}
        />
      </div>

      {status === 'loading' && scores.length === 0 && <p>Loading scores...</p>}
      {status === 'error' && <p className="error">{error}</p>}

      {status === 'ready' && scores.length === 0 && <p>No scores yet. Be the first to play.</p>}

      {scores.length > 0 && (
        <>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, index) => (
                <tr key={entry._id || `${entry.playerName}-${index}`}>
                  <td>{rankStart + index + 1}</td>
                  <td>{entry.playerName}</td>
                  <td>{entry.score}</td>
                  <td>{formatScoreDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              className="button button-secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages} ({total} scores)
            </span>
            <button
              className="button button-secondary"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </>
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
