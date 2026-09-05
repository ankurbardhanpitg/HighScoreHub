export function createTwenty48Audio() {
  let ctx = null;

  function getCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!ctx) {
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function beep({ type = 'square', freq = 440, freqEnd, duration = 0.08, volume = 0.08, delay = 0 }) {
    try {
      const audio = getCtx();
      if (!audio) {
        return;
      }

      const start = audio.currentTime + delay;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, start);
      if (freqEnd) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + duration);
      }
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Ignore audio errors so a blocked sound never stops play.
    }
  }

  function mergePitch(value) {
    const steps = Math.max(1, Math.round(Math.log2(value || 2)));
    return 280 + steps * 38;
  }

  return {
    unlock: getCtx,
    start() {
      beep({ type: 'sine', freq: 523, duration: 0.1, volume: 0.07 });
      beep({ type: 'sine', freq: 659, duration: 0.14, volume: 0.07, delay: 0.08 });
    },
    slide() {
      beep({ type: 'triangle', freq: 420, freqEnd: 260, duration: 0.07, volume: 0.045 });
    },
    merge(value) {
      const freq = mergePitch(value);
      beep({ type: 'triangle', freq, duration: 0.08, volume: 0.08 });
      beep({ type: 'sine', freq: freq * 1.5, duration: 0.11, volume: 0.055, delay: 0.04 });
    },
    win() {
      beep({ type: 'sine', freq: 523, duration: 0.1, volume: 0.09 });
      beep({ type: 'sine', freq: 659, duration: 0.1, volume: 0.09, delay: 0.1 });
      beep({ type: 'sine', freq: 784, duration: 0.12, volume: 0.1, delay: 0.2 });
      beep({ type: 'sine', freq: 1046, duration: 0.22, volume: 0.1, delay: 0.32 });
    },
    lose() {
      beep({ type: 'triangle', freq: 330, freqEnd: 110, duration: 0.4, volume: 0.09 });
    },
    end() {
      beep({ type: 'sine', freq: 392, freqEnd: 220, duration: 0.22, volume: 0.07 });
    },
  };
}
