const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'flappyAuthToken';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function readError(response) {
  try {
    const data = await response.json();
    return data.error || 'Request failed';
  } catch {
    return 'Request failed';
  }
}

function authHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export function signUp(username, email, password) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

export function signIn(email, password) {
  return request('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchCurrentUser() {
  return request('/api/auth/me');
}

export function submitScore(score) {
  return request('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
}

export function fetchTopScores() {
  return request('/api/scores/top');
}
