import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignIn() {
  const { signin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      await signin(email, password);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Could not sign in');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">Welcome back</p>
      <h1>Sign in and fly</h1>
      <p>Use your email and password to jump back into the sky.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="button button-play" type="submit" disabled={saving}>
          {saving ? 'Signing in...' : 'Let’s go'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="auth-switch">
        New here? <Link to="/signup" state={{ from: redirectTo }}>Join the flock</Link>
      </p>
    </section>
  );
}
