const PLAYER_KEY = 'highscorehub-chess-player-id';

export function getChessPlayerId() {
  try {
    let id = sessionStorage.getItem(PLAYER_KEY);
    if (!id) {
      id =
        crypto.randomUUID?.() ||
        `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function chessWsUrl() {
  const base =
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
  const url = new URL('/ws/chess', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function parseChessRoomInput(value) {
  const trimmed = String(value || '').trim();
  const fromUrl = trimmed.match(/\/game\/chess\/room\/([A-Za-z0-9]+)/i);
  const raw = fromUrl ? fromUrl[1] : trimmed;
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
}

export function chessRoomUrl(roomId) {
  return `${window.location.origin}/game/chess/room/${roomId}`;
}
