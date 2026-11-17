// Colours. The product: bone alphas, charcoal modifiers, one cobalt key. The page around it changes with the
// alphabet scene: sepia ink for the Arabic script, red print for 1929, typewriter grey for 1939.
const hex = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
export const lin = hex;

export const CAP = { alpha: hex('#dcd6c9'), mod: hex('#2b2d32'), accent: hex('#2c48d6'), light: hex('#ece6da') };
export const CASES = {
  qrafit: { body: hex('#3a3c41'), edge: hex('#c9ccd2'), name: 'Qrafit' },
  gumus: { body: hex('#b4b8bf'), edge: hex('#eef0f3'), name: 'Gümüş' },
  qum: { body: hex('#c6b796'), edge: hex('#efe6d2'), name: 'Qum' },
};
export const SWITCHES = {
  red: { stem: hex('#c3392c'), name: 'Qırmızı', kind: 'xətti' },
  brown: { stem: hex('#7a4a2b'), name: 'Qəhvəyi', kind: 'taktil' },
  blue: { stem: hex('#2b66c8'), name: 'Göy', kind: 'klik' },
};

// era palettes: [bgTop, bgBot, ink on light caps, word colour]
const ERAS = [
  { top: '#ece7dc', bot: '#d6cfbf', ink: '#1c1d21', word: '#1c1d21', css: { bg: '#e6e0d3', ink: '#1c1d21', soft: '#5b5a55', acc: '#2c48d6' } },
  { top: '#e8d8b6', bot: '#c9b48b', ink: '#4a2a14', word: '#4a2a14', css: { bg: '#e2d0aa', ink: '#3e2412', soft: '#6e5236', acc: '#8a3b16' } },
  { top: '#ece0c8', bot: '#d5c3a2', ink: '#b02f1c', word: '#b02f1c', css: { bg: '#e6d8bd', ink: '#1d1a17', soft: '#5d5246', acc: '#b02f1c' } },
  { top: '#cfd2c6', bot: '#aeb4a4', ink: '#22272b', word: '#22272b', css: { bg: '#c4c8ba', ink: '#1d2125', soft: '#4c524f', acc: '#22272b' } },
  { top: '#ece7dc', bot: '#d6cfbf', ink: '#1c1d21', word: '#1c1d21', css: { bg: '#e6e0d3', ink: '#1c1d21', soft: '#5b5a55', acc: '#1c1d21' } },
];
ERAS.forEach((e) => { e.T = hex(e.top); e.B = hex(e.bot); e.I = hex(e.ink); e.W = hex(e.word); });
export const ERA_INK = ERAS.map((e) => e.I);

const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// era weights w[0..4] (sum 1) -> theme for the renderer
export function themeAt(w) {
  let top = [0, 0, 0], bot = [0, 0, 0], word = [0, 0, 0];
  w.forEach((k, i) => { if (!k) return; top = top.map((v, j) => v + ERAS[i].T[j] * k); bot = bot.map((v, j) => v + ERAS[i].B[j] * k); word = word.map((v, j) => v + ERAS[i].W[j] * k); });
  return {
    bgTop: top, bgBot: bot, word,
    envTop: mix3(top, [1.15, 1.13, 1.1], 0.55), envBot: mix3(bot, [0.12, 0.11, 0.1], 0.5),
    key: [1.0, 0.97, 0.92],
  };
}
const cssHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function applyCss(w) {
  const keys = ['bg', 'ink', 'soft', 'acc'];
  const root = document.documentElement.style;
  for (const k of keys) {
    const c = [0, 0, 0];
    w.forEach((a, i) => { if (a) cssHex(ERAS[i].css[k]).forEach((v, j) => (c[j] += v * a)); });
    root.setProperty(`--${k}`, `rgb(${c.map((v) => Math.round(v)).join(',')})`);
  }
}
