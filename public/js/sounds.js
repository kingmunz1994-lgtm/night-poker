// ── Night Poker — Sound Engine (Web Audio API, zero audio files) ─

const NightSounds = (() => {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, type, dur, vol = 0.25, t0 = 0) {
    if (!enabled) return;
    try {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime + t0);
      g.gain.setValueAtTime(0,   c.currentTime + t0);
      g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur);
      o.start(c.currentTime + t0);
      o.stop(c.currentTime  + t0 + dur + 0.02);
    } catch {}
  }

  function noise(dur, vol = 0.08, t0 = 0) {
    if (!enabled) return;
    try {
      const c = ac();
      const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      src.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(vol, c.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur);
      src.start(c.currentTime + t0);
      src.stop(c.currentTime + t0 + dur + 0.02);
    } catch {}
  }

  return {
    toggle() {
      enabled = !enabled;
      const btn = document.getElementById('sound-toggle');
      if (btn) btn.textContent = enabled ? '🔊' : '🔇';
      return enabled;
    },
    isEnabled() { return enabled; },

    deal() {
      noise(0.04, 0.12);
      tone(900, 'sine', 0.07, 0.18, 0.03);
    },

    shuffle() {
      for (let i = 0; i < 5; i++) {
        noise(0.03, 0.10, i * 0.07);
        tone(300 + i * 40, 'sawtooth', 0.03, 0.06, i * 0.07 + 0.01);
      }
    },

    chip() {
      tone(1400, 'sine', 0.04, 0.22);
      tone(1000, 'sine', 0.07, 0.18, 0.04);
      noise(0.03, 0.06, 0.01);
    },

    yourTurn() {
      tone(660, 'sine', 0.10, 0.28);
      tone(880, 'sine', 0.10, 0.28, 0.12);
      tone(1100,'sine', 0.12, 0.20, 0.23);
    },

    fold() {
      tone(350, 'sine', 0.18, 0.20);
      tone(280, 'sine', 0.22, 0.12, 0.10);
    },

    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(f, 'sine', 0.28, 0.28, i * 0.10)
      );
    },

    allIn() {
      tone(180, 'sawtooth', 0.45, 0.30);
      tone(220, 'sawtooth', 0.35, 0.25, 0.08);
      tone(140, 'sawtooth', 0.50, 0.20, 0.18);
    },

    raise() {
      tone(550, 'sine', 0.07, 0.22);
      tone(750, 'sine', 0.09, 0.22, 0.07);
    },

    call() {
      tone(550, 'sine', 0.08, 0.18);
      noise(0.03, 0.07, 0.02);
    },

    check() {
      tone(440, 'sine', 0.06, 0.12);
    },

    newCard() {
      noise(0.03, 0.09);
      tone(750, 'triangle', 0.05, 0.14, 0.02);
    },

    tick() {
      tone(880, 'sine', 0.04, 0.08);
    },
  };
})();
