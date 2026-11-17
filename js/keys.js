// Per-key motion: the opening rain (deterministic in time, so ?intro= can freeze it), the alphabet flip wave
// (deterministic in scroll), and the live press physics (spring + bottom-out + top-out bounce).
import { KEYS, SCHWA, ERA } from './layout.js';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const rnd = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export const SEQ = [ERA.NOW, ERA.AR, ERA.Y29, ERA.CYR, ERA.Y91, ERA.NOW];
// is the letter on the Ə key a schwa in this alphabet (Ə, Ә)? then the key is cobalt
const SCHWA_ACC = { [ERA.NOW]: 1, [ERA.AR]: 0, [ERA.Y29]: 1, [ERA.CYR]: 1, [ERA.Y91]: 0 };

// ---------------------------------------------------------------- opening
// seconds: Ə falls 0.2–0.95, the rest from ~1.15, ordered by distance from Ə
export const INTRO_LEN = 4.4;
const HERO_FALL = [0.25, 1.0];
const order = KEYS.map((k) => {
  const d = Math.hypot(k.x - SCHWA.x, (k.z - SCHWA.z) * 1.25);
  return 1.5 + d * 0.1 + rnd(k.i, 1) * 0.08;
});
export const INTRO_DONE = Math.max(...order) + 0.9;

export function introPose(k, t, out) {
  const hero = k === SCHWA;
  const t0 = hero ? HERO_FALL[0] : order[k.i];
  const Df = hero ? HERO_FALL[1] : 0.42;
  const H0 = hero ? 5.2 : 6.5;
  const tau = t - t0;
  out.vis = tau >= 0 ? 1 : 0;
  out.lift = 0; out.rx = 0; out.rz = 0; out.ry = 0; out.press = 0;
  if (tau < 0) return out;
  if (tau < Df) {
    const u = tau / Df;
    out.lift = H0 * (1 - u * u);
    const spin = Math.pow(1 - u, 1.6);
    out.rx = (rnd(k.i, 2) - 0.5) * 1.4 * spin;
    out.rz = (rnd(k.i, 3) - 0.5) * 0.9 * spin;
    out.ry = (rnd(k.i, 4) - 0.5) * 1.1 * spin;
    if (hero) { const e = 1 - u; out.lift = H0 * (1 - u * u); out.rx = 0.9 * e * e; out.rz = -0.35 * e * e; out.ry = 1.4 * e * e; }
    return out;
  }
  // landing: the cap pushes the stem down, the spring throws it back, a smaller second bounce
  const a = tau - Df;
  const amp = hero ? 1 : 0.75;
  out.press = Math.min(1, amp * Math.exp(-9 * a) * Math.max(0, Math.sin(15 * a) + 0.35 * Math.max(0, Math.sin(30 * a - 2.6))));
  return out;
}
export const LAND = (k) => (k === SCHWA ? HERO_FALL[0] + HERO_FALL[1] : order[k.i] + 0.42);

// ---------------------------------------------------------------- alphabet wave
// g in [0, 5]: transition i -> i+1 happens while g goes from i to i+1; keys flip left to right
export function wavePose(k, g, out) {
  out.lift = 0; out.rx = 0; out.rz = 0; out.ry = 0; out.acc = 0;
  const i = Math.min(4, Math.max(0, Math.floor(g)));
  const f0 = Math.min(1, g - i);
  const a = SEQ[i], b = SEQ[i + 1];
  const moves = k.letter && (i < 4 || k === SCHWA);
  const delay = i === 4 ? 0 : ((k.x + 8) / 16) * 0.55 + ((k.z + 3.2) / 6.4) * 0.08;
  const f = i === 4 ? ss(0.15, 0.85, f0) : cl((f0 - delay) / 0.36);
  if (!moves) {
    // symbols and modifiers keep their legend; their ink changes as the wave passes
    out.eraA = out.eraB = i === 4 ? ERA.Y91 : f >= 0.5 ? b : a;
    out.flip = 0;
    return out;
  }
  const e = f * f * (3 - 2 * f);
  out.lift = Math.sin(Math.PI * f) * (i === 4 ? 2.2 : 1.15);
  out.rx = -TAU * e;
  out.rz = Math.sin(Math.PI * f) * (rnd(k.i, 5) - 0.5) * 0.25;
  out.eraA = a; out.eraB = b; out.flip = f >= 0.5 ? 1 : 0;
  if (k === SCHWA) out.acc = SCHWA_ACC[a] + (SCHWA_ACC[b] - SCHWA_ACC[a]) * ss(0.45, 0.6, f);
  return out;
}

// ---------------------------------------------------------------- press physics
export class Presses {
  constructor() {
    this.p = new Float32Array(KEYS.length);
    this.v = new Float32Array(KEYS.length);
    this.held = new Uint8Array(KEYS.length);
    this.tap = new Float32Array(KEYS.length); // time left of a synthetic tap
  }
  down(i) { this.held[i] = 1; this.v[i] = Math.max(this.v[i], 9); }
  up(i) { this.held[i] = 0; }
  tapKey(i, ms = 90) { this.tap[i] = ms / 1000; this.v[i] = Math.max(this.v[i], 10); }
  update(dt) {
    const n = KEYS.length;
    const steps = Math.ceil(dt / 0.004);
    const h = dt / steps;
    for (let i = 0; i < n; i++) {
      if (this.tap[i] > 0) this.tap[i] -= dt;
      const tgt = this.held[i] || this.tap[i] > 0 ? 1.15 : 0;
      for (let s = 0; s < steps; s++) {
        const a = (tgt - this.p[i]) * 700 - this.v[i] * 30;
        this.v[i] += a * h;
        this.p[i] += this.v[i] * h;
        if (this.p[i] > 1) { this.p[i] = 1; if (this.v[i] > 0) this.v[i] *= -0.25; } // bottom-out
        if (this.p[i] < 0) { this.p[i] = 0; if (this.v[i] < 0) this.v[i] *= -0.35; } // top-out: a small rebound
      }
    }
  }
}
