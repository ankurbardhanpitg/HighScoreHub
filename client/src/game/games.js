export const GAMES = [
  {
    id: 'flappy',
    name: 'Flappy Bird',
    shortName: 'Flappy',
    path: '/game',
    howToPath: '/howto/flappy',
    emoji: '🐦',
    cardClass: 'card-score',
    blurb: 'Tap or press Space to flap. Dodge the pipes and rack up points.',
    steps: [
      { emoji: '👆', title: 'Tap or Space', text: 'Give the bird a flap whenever it starts to fall.', cardClass: 'card-tap' },
      { emoji: '🌿', title: 'Dodge pipes', text: 'Fly through the green openings. Don’t bump the edges!', cardClass: 'card-dodge' },
      { emoji: '⭐', title: 'Score points', text: 'Each pipe you pass is a point. Beat your friends!', cardClass: 'card-score' },
    ],
  },
  {
    id: '2048',
    name: '2048',
    shortName: '2048',
    path: '/game/2048',
    howToPath: '/howto/2048',
    emoji: '🔢',
    cardClass: 'card-merge',
    blurb: 'Slide tiles, merge matching numbers, and chase a huge high score.',
    steps: [
      { emoji: '➡️', title: 'Slide the grid', text: 'Use arrow keys, WASD, or a swipe to move every tile.', cardClass: 'card-tap' },
      { emoji: '➕', title: 'Merge matches', text: 'When two tiles with the same number meet, they become one bigger tile.', cardClass: 'card-merge' },
      { emoji: '🎯', title: 'Chase 2048', text: 'Reach 2048, then keep going. Every merge adds to your score.', cardClass: 'card-score' },
    ],
  },
  {
    id: 'whack',
    name: 'Whack-a-Mole',
    shortName: 'Whack',
    path: '/game/whack',
    howToPath: '/howto/whack',
    emoji: '🔨',
    cardClass: 'card-whack',
    blurb: 'Tap moles as they pop up. Fast reflexes, instant bonks, big scores.',
    steps: [
      { emoji: '🕳️', title: 'Watch the holes', text: 'Moles peek out for just a moment. Don’t blink!', cardClass: 'card-tap' },
      { emoji: '👆', title: 'Tap to bonk', text: 'Hit a mole while it’s up. You’ll see a pop and hear a bonk.', cardClass: 'card-whack' },
      { emoji: '⏱️', title: 'Beat the clock', text: 'Set the time limit, then tap moles before they hide. Every hit is a point.', cardClass: 'card-score' },
    ],
  },
];

export const DEFAULT_GAME = 'flappy';

export function isValidGame(id) {
  return GAMES.some((game) => game.id === id);
}

export function getGame(id) {
  return GAMES.find((game) => game.id === id) || null;
}
