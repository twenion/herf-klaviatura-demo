// Canvas textures: the PCB (solder mask, copper traces, gold hot-swap pads, silkscreen) and the giant words
// behind the board.
import { KEYS } from './layout.js';

export async function fontsReady() {
  const loads = [
    '500 40px Unbounded', '800 40px Unbounded', '600 40px Unbounded', '400 20px Onest', '500 20px Onest', '600 20px Onest',
    '700 40px HerfNaskh', '700 40px HerfSans', '400 40px HerfMono',
  ];
  const sample = 'HƏRF Ə75 ƏəŞşĞğİıÇçÖöÜü 0123456789 ابجچدئهفگغحخیژکقلمنوؤپرسشتزۇۆؽ۰۱۲۳۴۵۶۷۸۹ ƢƵƟꞫ АБҸЧДЭӘФҜҒҺХЫИЖКГЛМНОӨПРСШТУҮВЙЗ';
  try { await Promise.all(loads.map((f) => document.fonts.load(f, sample))); await document.fonts.ready; } catch (e) { /* draw with fallbacks */ }
}

export const PCB = { x0: -8.12, z0: -3.24, w: 16.24, h: 6.48 };
export function pcbCanvas() {
  const W = 2048, H = Math.round((W * PCB.h) / PCB.w);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = (x) => ((x - PCB.x0) / PCB.w) * W, Z = (z) => ((z - PCB.z0) / PCB.h) * H, S = W / PCB.w;
  // traces: rows run along under the switches, columns drop between them
  g.strokeStyle = 'rgba(30, 52, 44, 1)'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 0.035 * S;
  const rows = [...new Set(KEYS.map((k) => k.z))];
  for (const z of rows) {
    const ks = KEYS.filter((k) => k.z === z).sort((a, b) => a.x - b.x);
    g.beginPath();
    ks.forEach((k, i) => {
      const x = k.x + 0.13, y = z - 0.27;
      if (!i) g.moveTo(X(x), Z(y));
      else { const px = ks[i - 1].x + 0.13; g.lineTo(X(px + 0.25), Z(y + 0.18)); g.lineTo(X(x - 0.35), Z(y + 0.18)); g.lineTo(X(x), Z(y)); }
    });
    g.stroke();
  }
  g.lineWidth = 0.025 * S;
  for (const k of KEYS) {
    const x = k.x - 0.2, z = k.z - 0.13;
    g.beginPath(); g.moveTo(X(x), Z(z)); g.lineTo(X(x - 0.12), Z(z + 0.12)); g.lineTo(X(x - 0.12), Z(k.z + 0.42)); g.lineTo(X(x - 0.02), Z(k.z + 0.52)); g.stroke();
  }
  // silkscreen footprints
  g.strokeStyle = 'rgba(232, 230, 222, 0.92)'; g.lineWidth = 0.012 * S;
  for (const k of KEYS) {
    const s = 0.37;
    g.strokeRect(X(k.x - s), Z(k.z - s), 2 * s * S, 2 * s * S);
    g.fillStyle = 'rgba(232, 230, 222, 0.92)';
    g.fillRect(X(k.x - 0.06), Z(k.z + 0.29), 0.12 * S, 0.06 * S); // south-facing LED
  }
  // pads and holes
  for (const k of KEYS) {
    g.fillStyle = '#d6a650';
    for (const [dx, dz] of [[-0.2, -0.133], [0.133, -0.267]]) { g.beginPath(); g.arc(X(k.x + dx), Z(k.z + dz), 0.06 * S, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(8, 9, 9, 1)';
    for (const [dx, dz] of [[-0.2, -0.133], [0.133, -0.267]]) { g.beginPath(); g.arc(X(k.x + dx), Z(k.z + dz), 0.026 * S, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(X(k.x), Z(k.z), 0.1 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d6a650';
    for (const dx of [-0.27, 0.27]) { g.beginPath(); g.arc(X(k.x + dx), Z(k.z), 0.045 * S, 0, Math.PI * 2); g.fill(); }
  }
  // vias
  g.fillStyle = '#c99a48';
  for (let i = 0; i < 160; i++) {
    const r = (n) => { const s = Math.sin(i * 91.3 + n * 17.7) * 43758.5; return s - Math.floor(s); };
    const k = KEYS[Math.floor(r(1) * KEYS.length)];
    g.beginPath(); g.arc(X(k.x + 0.45), Z(k.z + (r(2) - 0.5) * 0.7), 0.022 * S, 0, Math.PI * 2); g.fill();
  }
  // silkscreen text in the gap under the function row and at the edge
  g.fillStyle = 'rgba(236, 233, 224, 0.95)';
  g.font = `600 ${0.16 * S}px Unbounded, sans-serif`;
  g.textBaseline = 'middle';
  g.fillText('HƏRF Ə75', X(-7.9), Z(-1.98));
  g.font = `500 ${0.1 * S}px Onest, sans-serif`;
  g.fillText('rev 1.0 · hot-swap · Bakı', X(-5.6), Z(-1.98));
  g.fillText('Hər hərfin öz düyməsi', X(3.2), Z(-1.98));
  return c;
}

// rows of giant words for the backdrop; each row is 4:1
export const WORDS = ['Ə', 'ا', '1929', '1939', '1991', '1992'];
export function wordsCanvas() {
  const RW = 2048, RH = 512;
  const c = document.createElement('canvas');
  c.width = RW; c.height = RH * WORDS.length;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  WORDS.forEach((w, i) => {
    const fam = w === 'ا' ? '700 440px HerfNaskh' : `800 ${w.length > 1 ? 400 : 440}px Unbounded`;
    g.font = `${fam}, sans-serif`;
    const m = g.measureText(w);
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    g.fillText(w, RW / 2, i * RH + RH / 2 + h / 2 - m.actualBoundingBoxDescent);
  });
  return c;
}
