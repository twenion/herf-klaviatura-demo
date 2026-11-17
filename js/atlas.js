// Legend atlas. Every legend is drawn once into a cell the shape of its keycap's top and turned into a signed
// distance field (Felzenszwalb–Huttenlocher EDT), so a 120-pixel cell still has crisp edges when one key fills
// the screen. Five alphabets, each with the typeface of its time: Unbounded (today), Noto Naskh Arabic, Noto Sans
// (1929 Latin: Ƣ Ƶ Ɵ Ɜ), PT Mono (1939 Cyrillic).
import { ERA } from './layout.js';

const PX = 170; // texels per key unit
const GUT = 4;
const AW = 2048;
const RADIUS = 9;
const CUT = 0.25;

const FONT = {
  [ERA.NOW]: { fam: 'Unbounded', w: 500, cap: 0.36 },
  [ERA.Y91]: { fam: 'Unbounded', w: 500, cap: 0.36 },
  [ERA.AR]: { fam: 'HerfNaskh', w: 700, cap: 0.46 },
  [ERA.Y29]: { fam: 'HerfSans', w: 700, cap: 0.4 },
  [ERA.CYR]: { fam: 'HerfMono', w: 400, cap: 0.42 },
};
const ICONS = new Set(['⌫', '⇥', '⇪', '⏎', '⇧', '↑', '←', '↓', '→', '◆']);

// jobs: one per distinct (era style, text, cap width); keys look their cells up by era
export function planAtlas(keys, tops) {
  const jobs = [], byId = new Map();
  const cellH = Math.round(2 * tops[0].tz * PX);
  let x = 0, y = 0;
  const alloc = (w) => {
    if (x + w > AW) { x = 0; y += cellH + GUT; }
    const r = { x, y, w, h: cellH };
    x += w + GUT;
    return r;
  };
  const rects = keys.map(() => [null, null, null, null, null]);
  for (const era of [ERA.NOW, ERA.AR, ERA.Y29, ERA.CYR, ERA.Y91]) {
    for (const k of keys) {
      const text = k.letter ? k.era[era] : k.legend;
      const style = k.letter ? (era === ERA.Y91 ? ERA.NOW : era) : ERA.NOW;
      const t = tops[k.wi];
      const id = `${style}|${text}|${k.wi}|${k.kind === 'm' || !k.letter ? 'm' : 'a'}`;
      let job = byId.get(id);
      if (!job) {
        job = { id, era: style, text, small: !k.letter, wi: k.wi, cell: alloc(Math.round(2 * t.tx * PX)), code: k.code };
        byId.set(id, job); jobs.push(job);
      }
      rects[k.i][era] = job;
    }
  }
  const H = y + cellH + GUT;
  const AH = Math.pow(2, Math.ceil(Math.log2(H)));
  const uv = (j) => [j.cell.x / AW, j.cell.y / AH, (j.cell.x + j.cell.w) / AW, (j.cell.y + j.cell.h) / AH];
  return { jobs, W: AW, H: AH, data: new Uint8Array(AW * AH), rect: (ki, era) => uv(rects[ki][era]) };
}

let cvs = null, ctx = null;
const INF = 1e20;
let gO, gI, f, v, z;
function ensure(n, m) {
  if (!gO || gO.length < n) { gO = new Float64Array(n); gI = new Float64Array(n); }
  if (!f || f.length < m + 1) { f = new Float64Array(m + 1); v = new Uint16Array(m + 1); z = new Float64Array(m + 2); }
}

export function drawJobs(plan, list) {
  if (!cvs) { cvs = document.createElement('canvas'); ctx = cvs.getContext('2d', { willReadFrequently: true }); }
  for (const job of list) {
    const { w, h } = job.cell;
    if (cvs.width < w || cvs.height < h) { cvs.width = Math.max(cvs.width, w); cvs.height = Math.max(cvs.height, h); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    drawLegend(ctx, job, w, h);
    const img = ctx.getImageData(0, 0, w, h).data;
    sdf(img, w, h, plan.data, plan.W, job.cell.x, job.cell.y);
  }
}

function drawLegend(c, job, w, h) {
  const t = job.text;
  if (!t) return;
  if (ICONS.has(t)) return icon(c, t, w, h);
  const F = FONT[job.era];
  if (job.small) {
    const size = h * (t === 'HƏRF' ? 0.2 : t.length > 3 ? 0.21 : 0.25);
    c.font = `600 ${size}px ${t === 'HƏRF' ? 'Unbounded' : 'Onest'}, sans-serif`;
    centre(c, t, w, h, 0.02 * h);
    return;
  }
  const target = h * F.cap * (t.length > 1 ? 0.8 : 1);
  c.font = `${F.w} 100px ${F.fam}, sans-serif`;
  const ref = c.measureText(job.era === ERA.AR ? 'ب' : 'H');
  let size = (100 * target) / Math.max(1, ref.actualBoundingBoxAscent + (job.era === ERA.AR ? ref.actualBoundingBoxDescent : 0));
  if (job.era === ERA.AR) size = (100 * h * 0.4) / Math.max(1, ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent);
  c.font = `${F.w} ${size}px ${F.fam}, sans-serif`;
  if (t === 'Į') {
    // I with descender (1922–1933): no code point; an I with a short tail under its right side
    const m = c.measureText('I');
    const bw = m.actualBoundingBoxRight + m.actualBoundingBoxLeft, bh = m.actualBoundingBoxAscent;
    const x0 = w / 2 - bw / 2 + m.actualBoundingBoxLeft, base = h / 2 + bh / 2 - h * 0.04;
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillText('I', x0, base);
    c.fillRect(w / 2 + bw * 0.05, base - 1, bw * 0.55, bh * 0.24);
    return;
  }
  // keep wide glyphs inside the cap
  let m = c.measureText(t);
  const gw = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
  if (gw > w * 0.62) { size *= (w * 0.62) / gw; c.font = `${F.w} ${size}px ${F.fam}, sans-serif`; }
  centre(c, t, w, h, 0);
}

function centre(c, t, w, h, dy) {
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const m = c.measureText(t);
  const gw = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
  const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  c.fillText(t, w / 2 - gw / 2 + m.actualBoundingBoxLeft, h / 2 - gh / 2 + m.actualBoundingBoxAscent + dy);
}

function icon(c, t, w, h) {
  const s = h * 0.3, lw = Math.max(2, h * 0.055);
  const cx = w / 2, cy = h / 2;
  c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  const P = (pts, close = false, fill = false) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(cx + x * s, cy + y * s) : c.moveTo(cx + x * s, cy + y * s))); if (close) c.closePath(); fill ? c.fill() : c.stroke(); };
  const arrow = (dx, dy) => {
    const L = 0.62, H = 0.36;
    const ax = dx * L, ay = dy * L;
    P([[-ax, -ay], [ax, ay]]);
    const px = -dy, py = dx;
    P([[ax - dx * H + px * H, ay - dy * H + py * H], [ax, ay], [ax - dx * H - px * H, ay - dy * H - py * H]]);
  };
  switch (t) {
    case '↑': arrow(0, -1); break;
    case '↓': arrow(0, 1); break;
    case '←': arrow(-1, 0); break;
    case '→': arrow(1, 0); break;
    case '⇧': P([[0, -0.7], [0.62, -0.02], [0.28, -0.02], [0.28, 0.6], [-0.28, 0.6], [-0.28, -0.02], [-0.62, -0.02]], true); break;
    case '⇪': P([[0, -0.78], [0.6, -0.16], [0.27, -0.16], [0.27, 0.32], [-0.27, 0.32], [-0.27, -0.16], [-0.6, -0.16]], true); P([[-0.27, 0.66], [0.27, 0.66]]); break;
    case '⏎': P([[0.6, -0.6], [0.6, 0.18], [-0.55, 0.18]]); P([[-0.25, -0.12], [-0.6, 0.18], [-0.25, 0.48]]); break;
    case '⇥': P([[-0.7, 0], [0.5, 0]]); P([[0.15, -0.34], [0.5, 0], [0.15, 0.34]]); P([[0.72, -0.4], [0.72, 0.4]]); break;
    case '⌫': P([[-0.85, 0], [-0.4, -0.5], [0.8, -0.5], [0.8, 0.5], [-0.4, 0.5]], true); P([[-0.05, -0.2], [0.38, 0.2]]); P([[0.38, -0.2], [-0.05, 0.2]]); break;
    case '◆': P([[0, -0.42], [0.42, 0], [0, 0.42], [-0.42, 0]], true); break;
  }
}

// alpha image (RGBA) -> SDF written into the atlas at (ox, oy)
function sdf(img, w, h, out, OW, ox, oy) {
  const n = w * h;
  ensure(n, Math.max(w, h));
  for (let i = 0; i < n; i++) {
    const a = img[i * 4 + 3] / 255;
    gO[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
    gI[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
  }
  edt(gO, w, h); edt(gI, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const d = Math.sqrt(gO[i]) - Math.sqrt(gI[i]);
    out[(oy + y) * OW + ox + x] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / RADIUS + CUT))));
  }
}
function edt(g, w, h) {
  for (let x = 0; x < w; x++) edt1(g, x, w, h);
  for (let y = 0; y < h; y++) edt1(g, y * w, 1, w);
}
function edt1(g, off, stride, len) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 0; q < len; q++) f[q] = g[off + q * stride];
  for (let q = 1; q < len; q++) {
    let s;
    do { const r = v[k]; s = (f[q] - f[r] + q * q - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, kk = 0; q < len; q++) {
    while (z[kk + 1] < q) kk++;
    const r = v[kk];
    g[off + q * stride] = f[r] + (q - r) * (q - r);
  }
}
