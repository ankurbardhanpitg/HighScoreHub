const PLAYER_KEY = 'highscorehub-ludo-player-id';

export function getLudoPlayerId() {
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

export function ludoWsUrl() {
  const base =
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
  const url = new URL('/ws/ludo', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function parseLudoRoomInput(value) {
  const trimmed = String(value || '').trim();
  const fromUrl = trimmed.match(/\/game\/ludo\/room\/([A-Za-z0-9]+)/i);
  const raw = fromUrl ? fromUrl[1] : trimmed;
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
}

export function ludoRoomUrl(roomId) {
  return `${window.location.origin}/game/ludo/room/${roomId}`;
}
