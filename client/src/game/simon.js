export const PAD_COUNT = 4;

export const PADS = [
  { id: 0, name: 'green', label: 'Green', freq: 415 },
  { id: 1, name: 'red', label: 'Red', freq: 310 },
  { id: 2, name: 'yellow', label: 'Yellow', freq: 252 },
  { id: 3, name: 'blue', label: 'Blue', freq: 209 },
];

export const KEY_TO_PAD = {
  q: 0,
  Q: 0,
  1: 0,
  w: 1,
  W: 1,
  2: 1,
  a: 2,
  A: 2,
  3: 2,
  s: 3,
  S: 3,
  4: 3,
};

export function randomPad() {
  return Math.floor(Math.random() * PAD_COUNT);
}

export function extendSequence(sequence) {
  return [...sequence, randomPad()];
}

export function playbackTiming(round) {
  const progress = Math.min(1, Math.max(0, (round - 1) / 12));
  return {
    onMs: Math.round(520 - progress * 260),
    gapMs: Math.round(220 - progress * 90),
    betweenRoundsMs: 680,
  };
}
