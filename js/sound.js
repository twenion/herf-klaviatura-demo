// Switch sounds, synthesised (no recordings): a short pitched body for the "thock", filtered noise for the
// impact, a bright double transient for the clicky switch and a lighter "clack" on the way back up.
export class Sound {
  constructor() { this.on = false; this.ctx = null; this.type = 'red'; }
  enable(v) {
    this.on = v;
    if (!v) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.on = false; return; }
      const c = (this.ctx = new AC());
      const len = Math.floor(c.sampleRate * 0.4);
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = 0.7;
      this.comp.connect(this.master).connect(c.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  burst(t, { f, q = 1, type = 'bandpass', gain, dec, pan }) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    src.connect(fl).connect(g).connect(pan);
    src.start(t, Math.random() * 0.3); src.stop(t + dec + 0.02);
  }
  body(t, { f0, f1, gain, dec, pan }) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(pan);
    o.start(t); o.stop(t + dec + 0.02);
  }
  panner(x) {
    const c = this.ctx;
    const p = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (p.pan) p.pan.value = Math.max(-0.8, Math.min(0.8, x / 10));
    p.connect(this.comp);
    return p;
  }
  // a key reaching the bottom
  press(x = 0, w = 1, strength = 1) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.002, pan = this.panner(x), v = 0.92 + Math.random() * 0.16;
    const big = Math.min(1.6, Math.sqrt(w)); // long keys sound lower and fuller
    if (this.type === 'blue') {
      this.burst(t, { f: 4200 * v, q: 3, gain: 0.55 * strength, dec: 0.018, pan });
      this.burst(t + 0.011, { f: 3600 * v, q: 4, gain: 0.4 * strength, dec: 0.016, pan });
    }
    if (this.type === 'brown') this.burst(t - 0.001, { f: 1300 * v, q: 0.7, gain: 0.08 * strength, dec: 0.03, pan });
    this.body(t + 0.004, { f0: (this.type === 'red' ? 210 : 260) * v / big, f1: 120 / big, gain: 0.5 * strength, dec: 0.085 * big, pan });
    this.burst(t + 0.003, { f: 1800 * v / big, q: 0.9, gain: 0.42 * strength, dec: 0.04, pan });
    this.burst(t + 0.004, { f: 420 / big, type: 'lowpass', q: 0.5, gain: 0.35 * strength, dec: 0.1 * big, pan });
  }
  // the stem hitting the top housing on the way up
  release(x = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.002, pan = this.panner(x);
    this.burst(t, { f: 2600 * (0.9 + Math.random() * 0.2), q: 1.4, gain: this.type === 'blue' ? 0.3 : 0.18, dec: 0.022, pan });
  }
}
