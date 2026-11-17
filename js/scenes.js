// Scroll position -> targets for the camera, the board and the page. Each scene has its own progress p (0..1);
// main.js eases toward these values every frame. The board is the stage: it stays in the middle and the
// camera moves around it.
import { SCHWA } from './layout.js';
import { CASE } from './geo.js';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const L3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const SX = SCHWA.x, SZ = SCHWA.z;
export const TILT = CASE.angle;

// alphabet scene timeline: [start, end] of each transition in p
export const WAVES = [[0.07, 0.19], [0.27, 0.39], [0.47, 0.59], [0.67, 0.77], [0.84, 0.92]];
export function eraG(p) {
  let g = 0;
  WAVES.forEach(([a, b], i) => { if (p >= a) g = i + cl((p - a) / (b - a)); });
  return g;
}

export function base(c) {
  const M = c.mobile;
  return {
    focus: [0, 0.2, 0.35], dist: M ? 46 : 24, pitch: 0.6, fov: 28, offX: 0, offY: M ? 0.02 : -0.02,
    yaw: 0, tilt: TILT, roll: 0, idle: 0,
    caps: 0, sw: 0, plate: 0, pcb: 0, foam: 0,
    oneCap: 0, oneStem: 0, oneSpring0: -0.24, oneFree: 0, oneTop: 0, oneBase: 0, inner: 0, wordIdx: [0, 1, 2, 3],
    cutX: 0.8, g: -1, wordA: [0, 0, 0, 0], wordX: [0, 0, 0, 0], wordY: 0.12, wordH: 0.55, shadow: 1,
    ui: {},
  };
}

export function scene(name, p, c) {
  const M = c.mobile;
  const s = base(c);
  switch (name) {
    case 'hero': {
      s.idle = 1;
      s.focus = [0, 0.2, 0.25];
      s.dist = M ? 40 : 25.5;
      s.pitch = M ? 0.98 : 0.56;
      s.yaw = M ? -1.05 : 0;
      s.offY = M ? -0.13 : -0.1;
      s.wordA = [0.07 * (1 - p), 0, 0, 0]; s.wordH = 0.95; s.wordY = 0.04;
      break;
    }
    case 'type': {
      s.focus = M ? [-0.6, 0.4, 0.55] : [0, 0.3, 0.35];
      s.dist = M ? 43 : 25;
      s.pitch = M ? 1.2 : 0.78;
      s.offY = M ? -0.12 : -0.1;
      s.yaw = 0;
      break;
    }
    case 'macro': {
      // dive to Ə · it rises above its neighbours · the camera goes round to its side · the cap is cut open
      const a = ss(0.0, 0.3, p), up = ss(0.2, 0.42, p), side = ss(0.4, 0.56, p), cut = ss(0.5, 0.72, p) * (1 - ss(0.92, 1, p));
      const k = [SX, 0.75 + up * 1.05, SZ];
      const from = M ? [-0.6, 0.4, 0.55] : [0, 0.3, 0.35];
      s.focus = L3(from, L3(k, [SX - 0.1, 1.62, SZ], side), a);
      s.dist = lerp(M ? 43 : 25, lerp(M ? 6.4 : 3.9, M ? 3.4 : 2.15, side), Math.pow(a, 0.7));
      s.pitch = lerp(M ? 1.2 : 0.78, lerp(0.3, 0.16, side), a);
      s.offY = lerp(M ? -0.12 : -0.1, M ? 0.1 : 0.04, a);
      s.yaw = lerp(0, lerp(-0.62, -1.42, side), a);
      s.oneCap = up * 1.05;
      s.cutX = lerp(0.8, -0.04, cut);
      s.ui = { cut };
      break;
    }
    case 'explode': {
      // A: one switch rises out of the board and comes apart · B: a slow press of the bare parts ·
      // C: the whole board in layers
      const a = ss(0.02, 0.3, p), press = Math.sin(Math.PI * cl((p - 0.32) / 0.14)) * (p > 0.32 && p < 0.46 ? 1 : 0);
      const back = ss(0.5, 0.6, p), e = ss(0.55, 0.86, p);
      const one = a * (1 - back);
      const B = 1.35 * one;
      s.inner = 1;
      s.oneBase = B;
      s.oneSpring0 = lerp(-0.24, B - 0.1, one);
      s.oneFree = lerp(0.23, 0.64, one) - press * 0.3 * one;
      s.oneStem = (B + 0.85) * one - press * 0.3 * one;
      s.oneTop = (B + 1.75) * one;
      s.oneCap = lerp(1.05 * (1 - back), B + 2.2, one);
      const fA = [SX, 0.75 + B * 1.45, SZ], fC = [0, 1.9, 0.2];
      s.focus = L3(fA, fC, back);
      s.dist = lerp(M ? 15.5 : 11.5, M ? 46 : 33.5, Math.pow(back, 0.8));
      s.pitch = lerp(0.16, 0.36, back);
      s.yaw = lerp(-0.42, M ? 0.85 : -0.38, back) + e * (M ? 0 : 0.12);
      s.offX = M ? 0 : lerp(0.1, 0.05, back);
      s.offY = lerp(M ? 0.04 : 0, M ? 0.08 : 0.04, back);
      s.caps = 1.8 * e; s.sw = 3.15 * e; s.plate = 2.35 * e; s.pcb = 1.6 * e; s.foam = 0.95 * e;
      s.shadow = 1 - 0.6 * e;
      s.ui = { one, press, e, back };
      break;
    }
    case 'alphabet': {
      const g = eraG(p);
      s.g = g;
      const last = ss(0.8, 0.88, p);
      const fAll = M ? [lerp(-3.2, 2.4, cl((p - 0.05) / 0.8)), 0.3, 0.4] : [0, 0.3, 0.3];
      s.focus = L3(fAll, [SX, 0.7, SZ], last);
      s.dist = lerp(M ? 42 : 26, M ? 17 : 12.5, last);
      s.pitch = lerp(M ? 1.32 : 1.22, 0.95, last);
      s.offY = lerp(M ? -0.06 : -0.05, M ? -0.16 : -0.14, last);
      s.yaw = lerp(0, -0.25, last);
      // the year behind the board: which era is on screen
      const holds = [[0.19, 0.27, 1], [0.39, 0.47, 2], [0.59, 0.67, 3], [0.77, 0.84, 4], [0.92, 1.01, 5]];
      const wa = [0, 0, 0, 0], wi = [0, 0, 0, 0];
      holds.forEach(([a, b, row], i) => {
        const o = ss(a - 0.04, a + 0.01, p) * (1 - ss(b - 0.01, b + 0.04, p));
        if (o > wa[i % 2] || !wa[i % 2]) { wa[i % 2] = Math.max(wa[i % 2], o); wi[i % 2] = row; }
      });
      s.wordA = [wa[0] * 0.13, wa[1] * 0.13, 0, 0]; s.wordIdx = [wi[0], wi[1], 0, 0];
      s.wordH = M ? 0.42 : 0.62; s.wordY = M ? 0.28 : 0.2;
      s.ui = { g, last };
      break;
    }
    case 'shop': {
      s.idle = 1;
      s.focus = [0, 0.2, 0.3];
      s.dist = M ? 50 : 24;
      s.pitch = M ? 0.8 : 0.5;
      s.yaw = M ? -0.62 : -0.18;
      s.offY = M ? 0.12 : 0.06;
      break;
    }
  }
  return s;
}
