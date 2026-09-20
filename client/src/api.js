const API_BASE = import.meta.env.VITE_API_URL ?? '';
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

export function submitScore(score, game = 'flappy') {
  return request('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ score, game }),
  });
}

export function createChessRoom(playerId, name) {
  return request('/api/chess/rooms', {
    method: 'POST',
    body: JSON.stringify({ playerId, name }),
  });
}

export function fetchTopScores(page = 1, limit = 10, game = 'flappy') {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    game,
  });
  return request(`/api/scores/top?${params.toString()}`);
}
