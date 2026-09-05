import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignUp() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const redirectTo = location.state?.from || '/';

  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, redirectTo]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await signup(username, email, password);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Could not create account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">New player</p>
      <h1>Join HighScoreHub</h1>
      <p>Pick a player name so your scores can shine on the board.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="username">Player name</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={3}
          maxLength={20}
          required
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />
        <button className="button button-play" type="submit" disabled={saving}>
          {saving ? 'Creating account...' : 'Create my account'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="auth-switch">
        Already have an account? <Link to="/signin" state={{ from: redirectTo }}>Sign in</Link>
      </p>
    </section>
  );
}
