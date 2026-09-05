export const GAMES = [
  { id: 'flappy', name: 'Flappy Bird', shortName: 'Flappy', path: '/game', emoji: '🐦' },
  { id: '2048', name: '2048', shortName: '2048', path: '/game/2048', emoji: '🔢' },
  { id: 'whack', name: 'Whack-a-Mole', shortName: 'Whack', path: '/game/whack', emoji: '🔨' },
];

export const DEFAULT_GAME = 'flappy';

export function isValidGame(id) {
  return GAMES.some((game) => game.id === id);
}

export function getGame(id) {
  return GAMES.find((game) => game.id === id) || GAMES[0];
}
