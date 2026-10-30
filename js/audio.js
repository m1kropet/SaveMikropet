/* Синтезированный звук на WebAudio: без внешних файлов, у каждого героя свой голос. */
(function (K) {
  'use strict';
  let ctx = null, master = null, enabled = true;
  const last = {};

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(type, f0, f1, dur, vol, delay) {
    const c = ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur, vol, freq, q) {
    const c = ctx, t = c.currentTime;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur);
  }

  const SFX = {
    blaster: () => tone('square', 1400 + Math.random() * 300, 700, 0.06, 0.05),
    dragon: () => { noise(0.25, 0.12, 700, 0.8); tone('sawtooth', 220, 110, 0.2, 0.04); },
    ice: () => { tone('sine', 1800, 2400, 0.12, 0.06); tone('sine', 2600, 3000, 0.1, 0.03, 0.03); },
    prism: () => tone('sawtooth', 1200, 180, 0.3, 0.07),
    storm: () => { noise(0.12, 0.15, 3200, 2); tone('square', 90, 60, 0.12, 0.04); },
    piggy: () => { tone('sine', 1320, 0, 0.08, 0.07); tone('sine', 1760, 0, 0.12, 0.06, 0.05); },
    die: () => tone('triangle', 180, 60, 0.15, 0.08),
    bossDie: () => { tone('sawtooth', 120, 30, 1.0, 0.15); noise(0.8, 0.2, 300, 0.7); },
    leak: () => { tone('square', 220, 110, 0.25, 0.08); tone('square', 207, 100, 0.25, 0.06, 0.12); },
    wave: () => { tone('sawtooth', 110, 0, 0.6, 0.06); tone('sawtooth', 165, 0, 0.6, 0.04, 0.05); },
    clear: () => { [523, 659, 784].forEach((f, i) => tone('triangle', f, 0, 0.18, 0.06, i * 0.08)); },
    buy: () => { tone('triangle', 880, 1320, 0.1, 0.07); },
    deny: () => tone('square', 160, 120, 0.15, 0.06),
    click: () => tone('triangle', 660, 0, 0.04, 0.04),
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, 0, 0.35, 0.08, i * 0.12)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, 0, 0.4, 0.06, i * 0.18)); },
    secret: () => { [196, 233, 277, 330, 392].forEach((f, i) => tone('sine', f, f * 0.5, 0.9, 0.06, i * 0.15)); noise(1.5, 0.08, 200, 0.5); },
    boss: () => { tone('sawtooth', 55, 40, 1.4, 0.15); noise(1.2, 0.1, 150, 0.6); },
    // новые башни
    trap: () => { tone('square', 900, 400, 0.05, 0.05); noise(0.05, 0.08, 3000, 3); },
    vacuum: () => { noise(0.3, 0.1, 500, 0.5); tone('sawtooth', 160, 90, 0.25, 0.03); },
    ivy: () => tone('triangle', 520, 340, 0.08, 0.05),
    voodoo: () => { tone('sine', 220, 180, 0.25, 0.06); tone('sine', 233, 190, 0.25, 0.04, 0.05); },
    mortar: () => { tone('sine', 120, 45, 0.35, 0.16); noise(0.3, 0.12, 250, 0.7); },
    flame: () => noise(0.12, 0.05, 900, 0.6),
    keys: () => { tone('triangle', 1800, 0, 0.05, 0.04); tone('triangle', 2400, 0, 0.05, 0.03, 0.04); },
    exorcist: () => { tone('sine', 1320, 1760, 0.15, 0.05); tone('sine', 1980, 0, 0.2, 0.03, 0.05); },
    clock: () => { [880, 660].forEach((f, i) => tone('square', f, 0, 0.04, 0.05, i * 0.12)); tone('sine', 140, 70, 0.8, 0.08, 0.2); }
  };

  K.Audio = {
    setEnabled(v) { enabled = !!v; if (!enabled && ctx) ctx.suspend().catch(() => {}); },
    unlock() { ensure(); },
    play(name, gap) {
      if (!enabled || !SFX[name]) return;
      const now = performance.now();
      if (now - (last[name] || 0) < (gap == null ? 45 : gap)) return;
      last[name] = now;
      if (!ensure()) return;
      try { SFX[name](); } catch (e) { /* звук не критичен */ }
    }
  };
})(globalThis.KV = globalThis.KV || {});
