export const GAMES = [
  {
    id: 'flappy',
    name: 'Flappy Bird',
    shortName: 'Flappy',
    path: '/game',
    howToPath: '/howto/flappy',
    emoji: '🐦',
    cardClass: 'card-score',
    blurb: 'Tap or press Space to flap. Clear 20 pipes to go up a level, then beat all 5 levels to win.',
    steps: [
      { emoji: '👆', title: 'Tap or Space', text: 'Give the bird a flap whenever it starts to fall.', cardClass: 'card-tap' },
      { emoji: '🌿', title: 'Dodge pipes', text: 'Fly through the green openings. Don’t bump the edges!', cardClass: 'card-dodge' },
      { emoji: '🏁', title: 'Beat 5 levels', text: 'Each pipe is a point. Pass 20 pipes to level up — later levels are faster and tighter. Clear all 5 to win!', cardClass: 'card-score' },
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
  {
    id: 'pong',
    name: 'Pong',
    shortName: 'Pong',
    path: '/game/pong',
    howToPath: '/howto/pong',
    emoji: '🏓',
    cardClass: 'card-pong',
    blurb: 'One player vs the computer. Move your paddle, bounce the ball, first to 5 wins.',
    steps: [
      { emoji: '👆', title: 'Move your paddle', text: 'Slide a finger, move the mouse, or use the arrow keys. Your paddle is the pink one on the left.', cardClass: 'card-tap' },
      { emoji: '🏓', title: 'Hit the ball', text: 'Bounce it past the blue computer paddle. Aim with the edge of your paddle to send it up or down.', cardClass: 'card-pong' },
      { emoji: '⭐', title: 'First to 5', text: 'Every ball the computer misses is a point. Reach 5 before the CPU does!', cardClass: 'card-score' },
    ],
  },
  {
    id: 'breakout',
    name: 'Breakout',
    shortName: 'Breakout',
    path: '/game/breakout',
    howToPath: '/howto/breakout',
    emoji: '🧱',
    cardClass: 'card-breakout',
    blurb: 'Aim the ball, bounce it off the paddle, and smash every brick. Steeper angles, smarter shots.',
    steps: [
      { emoji: '🎯', title: 'Aim your shot', text: 'Move the paddle to point the dotted line. That line is the path the ball will take.', cardClass: 'card-tap' },
      { emoji: '📐', title: 'Use the angle', text: 'Hit the ball with the edge of the paddle to send it sideways. Bank it off a wall to reach tricky bricks.', cardClass: 'card-breakout' },
      { emoji: '🧱', title: 'Clear the wall', text: 'Break every brick to go up a level. Combos and bank shots score extra. Don’t let the ball fall!', cardClass: 'card-score' },
    ],
  },
  {
    id: 'starwaves',
    name: 'Star Waves',
    shortName: 'Star Waves',
    path: '/game/starwaves',
    howToPath: '/howto/starwaves',
    emoji: '🚀',
    cardClass: 'card-starwaves',
    blurb: 'Move your ship, blast the star blobs, and clear each wave before they reach you.',
    steps: [
      { emoji: '🚀', title: 'Steer your ship', text: 'Slide a finger, move the mouse, or use the arrow keys along the bottom.', cardClass: 'card-tap' },
      { emoji: '⭐', title: 'Blast the blobs', text: 'Tap the game or press Space to shoot. Back-row blobs are worth extra points.', cardClass: 'card-starwaves' },
      { emoji: '🌊', title: 'Clear the wave', text: 'Zap every blob to start a faster wave. Dodge their sparkles — you have 3 lives!', cardClass: 'card-score' },
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
