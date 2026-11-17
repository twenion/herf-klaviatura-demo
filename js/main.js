import { Board, CAP_BASE, rotMat } from './gl.js';
import { KEYS, BY_CODE, SCHWA, ERA } from './layout.js';
import { planAtlas, drawJobs } from './atlas.js';
import { fontsReady, pcbCanvas, wordsCanvas, WORDS } from './textures.js';
import { scene, WAVES } from './scenes.js';
import { introPose, wavePose, Presses, INTRO_DONE, LAND, SEQ } from './keys.js';
import { themeAt, applyCss, CASES, SWITCHES, ERA_INK } from './theme.js';
import { initShop } from './shop.js';
import { Sound } from './sound.js';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs = new URLSearchParams(location.search);

const sound = new Sound();

const sections = $$('[data-scene]').map((el) => ({
  el, name: el.dataset.scene, pin: el.classList.contains('pin'),
  caps: $$('.cap, .era', el).map((c) => ({ el: c, at: +c.dataset.at, until: c.dataset.until ? +c.dataset.until : null })),
}));

const canvas = $('#gl');
let board = null;
try { board = new Board(canvas); root.classList.add('gl'); } catch (e) { console.warn('WebGL2 unavailable', e); }

const mobileQ = matchMedia('(max-width: 860px)');
let W = 0, H = 0, mobile = false, q = 1;
function measure() {
  W = canvas.clientWidth || innerWidth;
  H = canvas.clientHeight || innerHeight;
  mobile = mobileQ.matches;
  if (board) board.resize(W, H, Math.min(devicePixelRatio || 1, 2) * q);
}

function activeSection() {
  let cur = sections[0];
  for (const s of sections) if (s.el.getBoundingClientRect().top <= innerHeight * 0.5) cur = s;
  return cur;
}
function progressOf(s) {
  const r = s.el.getBoundingClientRect();
  if (s.name === 'hero') return cl(-r.top / Math.max(1, r.height));
  if (s.pin) return cl(-r.top / Math.max(1, r.height - innerHeight));
  return cl(1 - r.top / innerHeight);
}

// ---------------------------------------------------------------- eased state
const cur = {};
function approach(tgt, a) {
  for (const k in tgt) {
    const v = tgt[k];
    if (typeof v === 'number') cur[k] = cur[k] === undefined ? v : cur[k] + (v - cur[k]) * a;
    else if (Array.isArray(v)) {
      if (!cur[k]) cur[k] = v.slice();
      for (let i = 0; i < v.length; i++) cur[k][i] += (v[i] - cur[k][i]) * a;
    }
  }
}

// ---------------------------------------------------------------- per-key state
const K = KEYS.map(() => ({ lift: 0, rx: 0, ry: 0, rz: 0, press: 0, swPress: 0, vis: 1, swVis: 1, acc: 0, rectA: [0, 0, 0, 0], rectB: [0, 0, 0, 0], eraA: 0, eraB: 0, flip: 0, cut: 0 }));
const pose = { lift: 0, rx: 0, ry: 0, rz: 0, press: 0, vis: 1, eraA: 0, eraB: 0, flip: 0, acc: 0 };
const presses = new Presses();
let atlas = null;

// ---------------------------------------------------------------- ripples
const rip = new Float32Array(32);
const ripList = [];
function ripple(k, amp = 1) { ripList.push({ x: k.x, z: k.z, t0: clock, amp }); if (ripList.length > 8) ripList.shift(); }
function ripUniform() {
  rip.fill(0);
  ripList.forEach((r, i) => { const age = clock - r.t0; if (age > 2.6) return; rip.set([r.x, r.z, age, r.amp], i * 4); });
  return rip;
}

// ---------------------------------------------------------------- typing
const typedEl = $('[data-typed]');
const typedWrap = $('.typed');
let text = '', lastUser = -10, ghost = null;
let curName = 'hero';
function typeChar(k, shift) {
  if (k.code === 'Backspace') { text = text.slice(0, -1); render(); return; }
  if (k.code === 'Enter' || k.code === 'Escape') { text = ''; render(); return; }
  if (!k.type) return;
  text = (text + k.type[shift ? 1 : 0]).slice(-34);
  render();
}
function render() { typedEl.textContent = text; }
function pressKey(k, { shift = false, tap = 0, type = true } = {}) {
  if (tap) presses.tapKey(k.i, tap); else presses.down(k.i);
  ripple(k, k === SCHWA ? 1.4 : 1);
  sound.press(k.x, k.w);
  if (type && curName === 'type') typeChar(k, shift);
}
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (shop.open) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = BY_CODE[e.code];
  if (!k || e.repeat) return;
  const typing = curName === 'type';
  if (typing && (k.type || k.code === 'Backspace')) e.preventDefault();
  if (typing) { lastUser = clock; ghost = null; }
  pressKey(k, { shift: e.shiftKey || e.getModifierState('CapsLock') });
});
addEventListener('keyup', (e) => {
  const k = BY_CODE[e.code];
  if (!k) return;
  presses.up(k.i);
  sound.release(k.x);
});
// touch / click on a keycap
let downAt = null;
addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
addEventListener('pointerup', (e) => {
  if (!downAt || !board || curName !== 'type') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  if (moved > 10 || performance.now() - downAt.t > 600) return;
  if (e.target.closest('a, button, input, textarea, label, .cart')) return;
  const k = hitKey(e.clientX, e.clientY);
  if (!k) return;
  lastUser = clock; ghost = null;
  pressKey(k, { tap: 110 });
  setTimeout(() => sound.release(k.x), 110);
}, { passive: true });

let lastS = null;
function hitKey(x, y) {
  if (!lastS) return null;
  const R = rotMat(lastS.yaw, lastS.tilt, lastS.roll), C = board.camera(lastS);
  let best = null, bz = 1e9;
  for (const k of KEYS) {
    const h = CAP_BASE + 0.44;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => board.project(lastS, [k.x + sx * (k.w / 2 - 0.03), h, k.z + sz * 0.47], C, R));
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside && pts[0][4] < bz) { best = k; bz = pts[0][4]; }
  }
  return best;
}
// a demo line types itself until the visitor types
const GHOST = ['Salam! Mən Ə75.', 'İndi sən yaz.'];
function ghostStep(dt) {
  if (reduced || curName !== 'type' || clock - lastUser < 6) { if (curName !== 'type') ghost = null; return; }
  if (!ghost) ghost = { line: 0, i: 0, wait: 0.7, clear: false };
  ghost.wait -= dt;
  if (ghost.wait > 0) return;
  const line = GHOST[ghost.line];
  if (ghost.clear) { text = ''; typedEl.textContent = ''; ghost.clear = false; ghost.wait = 0.5; return; }
  if (ghost.i >= line.length) { ghost.line = (ghost.line + 1) % GHOST.length; ghost.i = 0; ghost.clear = true; ghost.wait = 1.8; return; }
  const ch = line[ghost.i++];
  const k = KEYS.find((kk) => kk.type && (kk.type[0] === ch || kk.type[1] === ch));
  if (k) {
    const shift = k.type[1] === ch && k.type[0] !== ch;
    if (shift) presses.tapKey(BY_CODE.ShiftLeft.i, 120);
    presses.tapKey(k.i, 85); ripple(k, k === SCHWA ? 1.4 : 0.8); sound.press(k.x, k.w, 0.8);
    text = (text + ch).slice(-34); typedEl.textContent = text;
  }
  ghost.wait = ch === ' ' ? 0.16 : 0.09 + Math.random() * 0.07;
}

// ---------------------------------------------------------------- sound toggle
const soundBtn = $('[data-sound]');
soundBtn.addEventListener('click', () => {
  const on = soundBtn.getAttribute('aria-pressed') !== 'true';
  soundBtn.setAttribute('aria-pressed', String(on));
  sound.enable(on);
  if (on) { sound.type = shop.sw; presses.tapKey(SCHWA.i, 100); ripple(SCHWA, 1.4); sound.press(SCHWA.x, 1); }
});

// ---------------------------------------------------------------- force curve
const CURVES = {
  red: { pts: [[0, 30], [4, 60]], text: '45 q-da işə düşür, 4 mm-də dayanır.' },
  brown: { pts: [[0, 32], [0.9, 55], [1.5, 42], [2, 45], [4, 62]], text: 'Yarı yolda yüngül pillə hiss olunur.' },
  blue: { pts: [[0, 32], [1.6, 62], [1.9, 40], [2.2, 46], [4, 66]], text: 'Yarı yolda klik: həm hiss olunur, həm eşidilir.' },
};
const cX = (mm) => 30 + (mm / 4) * 196, cY = (g) => 120 - (g / 75) * 108;
function forceAt(c, mm) {
  const P = CURVES[c].pts;
  for (let i = 1; i < P.length; i++) if (mm <= P[i][0]) { const t = (mm - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t; }
  return P[P.length - 1][1];
}
function drawCurve(c = shop.sw) {
  const P = CURVES[c].pts;
  $('[data-curve]').setAttribute('d', P.map(([x, y], i) => `${i ? 'L' : 'M'}${cX(x).toFixed(1)} ${cY(y).toFixed(1)}`).join(' '));
  $('[data-curve-name]').textContent = `${SWITCHES[c].name} · ${SWITCHES[c].kind}`;
  $('[data-curve-text]').textContent = CURVES[c].text;
}
const curveEl = $('.curve'), curveDot = $('[data-curve-dot]');
const shop = initShop({ onChange: (st) => { sound.type = st.sw; drawCurve(st.sw); } });

// ---------------------------------------------------------------- labels in the exploded view
const tagsSvg = $('#tagLines');
const partEls = $$('.parts li'), layerEls = $$('.layers li');
const allTags = [...partEls, ...layerEls];
tagsSvg.innerHTML = allTags.map(() => '<line/><circle r="2.6"/>').join('');
const tagNodes = [...tagsSvg.children];
function placeTags(S, ui, E) {
  const showParts = curName === 'explode' && ui.one > 0.85 && !ui.back;
  const showLayers = curName === 'explode' && ui.e > 0.8;
  const one = S.one;
  const pts = {
    cap: [SCHWA.x, CAP_BASE + one.cap + 0.3, SCHWA.z],
    top: [SCHWA.x, 0.2 + one.off[3], SCHWA.z],
    stem: [SCHWA.x, 0.3 + one.off[1], SCHWA.z],
    spring: [SCHWA.x, one.off[2] + one.free * 0.5, SCHWA.z],
    bottom: [SCHWA.x, -0.12 + one.off[0], SCHWA.z],
  };
  const lay = {
    caps: [-7.4, CAP_BASE + E.sw + E.caps + 0.42, 2.62], sw: [-7.4, E.sw + 0.12, 2.62], plate: [-8.15, E.plate - 0.03, 3.25],
    pcb: [-8.05, E.pcb - 0.33, 3.2], foam: [-7.95, E.foam - 0.45, 3.1], case: [-8.5, 0.1, 3.62],
  };
  allTags.forEach((li, i) => {
    const isPart = i < partEls.length;
    const on = isPart ? showParts : showLayers;
    li.classList.toggle('is-on', on);
    tagNodes[i * 2].style.opacity = on ? 0.55 : 0; tagNodes[i * 2 + 1].style.opacity = on ? 1 : 0;
    if (!on) return;
    const a = board.project(S, isPart ? pts[li.dataset.part] : lay[li.dataset.layer]);
    const w = li.offsetWidth, h = li.offsetHeight;
    let x, y = a[1] - h / 2;
    if (isPart) x = a[0] + (mobile ? 46 : 120); else x = a[0] - w - (mobile ? 16 : 70);
    x = Math.max(8, Math.min(W - w - 8, x));
    li.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const lx = isPart ? x - 6 : x + w + 6;
    const ln = tagNodes[i * 2], dot = tagNodes[i * 2 + 1];
    ln.setAttribute('x1', a[0].toFixed(1)); ln.setAttribute('y1', a[1].toFixed(1)); ln.setAttribute('x2', lx.toFixed(1)); ln.setAttribute('y2', (y + h / 2).toFixed(1));
    dot.setAttribute('cx', a[0].toFixed(1)); dot.setAttribute('cy', a[1].toFixed(1));
  });
}

// ---------------------------------------------------------------- captions
function updateCaps(sec, p) {
  for (const s of sections) {
    if (!s.caps.length) continue;
    let latest = null;
    if (s === sec) for (const c of s.caps) if (c.until === null && p >= c.at) latest = c;
    for (const c of s.caps) c.el.classList.toggle('is-on', s === sec && (c.until === null ? c === latest : p >= c.at && p < c.until));
  }
  typedWrap.classList.toggle('is-on', sec.name === 'type');
}

// ---------------------------------------------------------------- intro
let introT = reduced ? 99 : 0;
const frozen = qs.has('intro');
if (frozen) introT = +qs.get('intro') * INTRO_DONE;

// ---------------------------------------------------------------- quality
let frames = 0, acc = 0;
function adapt(dt) {
  frames++; acc += dt;
  if (frames < 50) return;
  const avg = (acc / frames) * 1000;
  frames = 0; acc = 0;
  window.__herf = { q, avg: Math.round(avg * 10) / 10, px: [canvas.width, canvas.height] };
  if (avg > 30 && q > 0.55) { q = Math.max(0.55, q - 0.15); measure(); }
}

// ---------------------------------------------------------------- loop
let last = performance.now(), clock = 0, mouse = [0, 0];
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') mouse = [e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5]; }, { passive: true });
let eraW = [1, 0, 0, 0, 0];
let landed = new Uint8Array(KEYS.length);

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now; clock += dt;
  if (!frozen && introT < INTRO_DONE) introT += dt * (scrollY > 40 ? 3 : 1);
  if (introT > INTRO_DONE - 0.9 && !root.classList.contains('intro-done')) root.classList.add('intro-done');

  const sec = activeSection();
  curName = sec.name;
  const p = progressOf(sec);
  const tg = scene(sec.name, p, { mobile, aspect: W / H });
  // the opening flies from the falling Ə out to the whole board
  if (introT < INTRO_DONE && sec.name === 'hero') {
    const b = ss(1.25, 4.0, introT);
    const fall = ss(0.2, 1.25, introT);
    const near = { focus: [SCHWA.x, 0.5 + 2.4 * (1 - fall), SCHWA.z], dist: mobile ? 11 : 8, pitch: 0.12 + 0.3 * fall, yaw: -0.55 + 0.1 * fall, offY: 0 };
    tg.focus = near.focus.map((v, i) => v + (tg.focus[i] - v) * b);
    tg.dist = near.dist + (tg.dist - near.dist) * b;
    tg.pitch = near.pitch + (tg.pitch - near.pitch) * b;
    tg.yaw = near.yaw + (tg.yaw - near.yaw) * b;
    tg.offY = near.offY + (tg.offY - near.offY) * b;
  }
  if (!reduced && tg.idle) { tg.yaw += Math.sin(clock * 0.35) * 0.06 + mouse[0] * 0.12; tg.pitch += mouse[1] * 0.05; }
  const a = reduced ? 1 : 1 - Math.exp(-dt * (introT < INTRO_DONE ? 9 : 5));
  approach({ ...tg, ui: undefined, g: undefined }, a);

  // era colours
  const g = sec.name === 'alphabet' ? tg.g : -1;
  const wt = [0, 0, 0, 0, 0];
  if (g < 0) wt[0] = 1;
  else { const i = Math.min(4, Math.floor(g)), f = ss(0.15, 0.85, Math.min(1, g - i)); wt[SEQ[i]] += 1 - f; wt[SEQ[i + 1]] += f; }
  eraW = eraW.map((v, i) => v + (wt[i] - v) * (reduced ? 1 : 1 - Math.exp(-dt * 4)));
  applyCss(eraW);

  // keys
  presses.update(dt);
  const sched = { ...pose };
  KEYS.forEach((k, i) => {
    const st = K[i];
    let lift = 0, rx = 0, ry = 0, rz = 0, ip = 0, vis = 1;
    if (introT < INTRO_DONE) {
      introPose(k, introT, sched);
      lift = sched.lift; rx = sched.rx; ry = sched.ry; rz = sched.rz; ip = sched.press; vis = sched.vis;
      if (!landed[i] && introT >= LAND(k)) { landed[i] = 1; if (k === SCHWA) ripple(k, 2); else if (Math.random() < 0.25) ripple(k, 0.35); }
    }
    let eraA = ERA.NOW, eraB = ERA.NOW, flip = 0, accent = k === SCHWA ? 1 : 0;
    if (g >= 0 && k.letter !== undefined) {
      wavePose(k, g, sched);
      eraA = sched.eraA; eraB = sched.eraB; flip = sched.flip;
      if (k === SCHWA) accent = sched.acc;
      if (!reduced) { lift += sched.lift; rx += sched.rx; rz += sched.rz; }
    }
    const pr = Math.max(presses.p[i], ip);
    st.lift = lift; st.rx = rx; st.ry = ry; st.rz = rz; st.vis = vis; st.press = pr; st.swPress = pr; st.acc = accent;
    st.eraA = eraA; st.eraB = eraB; st.flip = flip;
    st.cut = k === SCHWA && cur.cutX < 0.79 ? 1 : 0;
    if (atlas) { st.rectA = atlas.rect(k.i, eraA); st.rectB = atlas.rect(k.i, eraB); }
  });
  ghostStep(dt);

  const sw = SWITCHES[shop.sw], cs = CASES[shop.caseC];
  const flash = introT < INTRO_DONE ? Math.max(0, Math.exp(-(introT - LAND(SCHWA)) * 5) * (introT > LAND(SCHWA) ? 1 : 0)) : 0;
  const S = {
    target: [0, 0, 0], orbit: 0, pitch: cur.pitch, dist: cur.dist, fov: 28, off: [cur.offX, cur.offY],
    pos: [0, 0, 0], yaw: cur.yaw, tilt: cur.tilt, roll: cur.roll, scale: 1,
    theme: themeAt(eraW), eraInk: ERA_INK, caseCol: cs, stemCol: sw.stem,
    exp: { caps: cur.caps, sw: cur.sw, plate: cur.plate, pcb: cur.pcb, foam: cur.foam },
    one: { index: SCHWA.i, off: [cur.oneBase, cur.oneStem, cur.oneSpring0, cur.oneTop], free: cur.oneFree, cap: cur.oneCap },
    cutX: cur.cutX, inner: cur.inner > 0.01, switches: true,
    knob: (scrollY / innerHeight) * 1.6 + clock * 0.05,
    wordRows: WORDS.length, wordA: cur.wordA, wordIdx: tg.wordIdx || [0, 1, 2, 3], wordX: cur.wordX, wordY: cur.wordY, wordH: cur.wordH,
    rip: ripUniform(), ripCol: [0.16, 0.27, 1.0], flash: flash * 0.8,
    shadow: cur.shadow, airShadows: introT < INTRO_DONE || g >= 0, time: clock,
    capCover: introT < INTRO_DONE ? K.reduce((a, s) => a + (s.vis && s.lift < 0.5 ? 1 : 0), 0) / K.length : 1,
  };
  // the camera looks at the focus point, expressed in the board's frame
  if (board) {
    const R = rotMat(S.yaw, S.tilt, S.roll);
    S.target = [0, 1, 2].map((r) => R[r][0] * cur.focus[0] + R[r][1] * cur.focus[1] + R[r][2] * cur.focus[2]);
    board.render(S, K);
    lastS = S;
  }
  updateCaps(sec, p);
  if (board) placeTags(S, tg.ui || {}, S.exp);
  // force curve: the dot follows the slow press of the bare parts
  const showCurve = sec.name === 'explode' && tg.ui && tg.ui.one > 0.8 && !(tg.ui.back > 0.05);
  curveEl.classList.toggle('is-on', !!showCurve);
  if (showCurve) { const mm = cl((tg.ui.press || 0) * 4); curveDot.setAttribute('cx', cX(mm).toFixed(1)); curveDot.setAttribute('cy', cY(forceAt(shop.sw, mm)).toFixed(1)); }
  adapt(dt);
  requestAnimationFrame(frame);
}

async function start() {
  await fontsReady();
  if (board) {
    board.uploadImage('pcb', pcbCanvas());
    board.uploadImage('words', wordsCanvas());
    const tops = board.caps.map((c) => ({ tx: c.tx, tz: c.tz }));
    const plan = planAtlas(KEYS, tops);
    // today's legends first, the old alphabets while the opening plays
    const now = plan.jobs.filter((j) => j.era === ERA.NOW);
    drawJobs(plan, now);
    board.uploadAtlas(plan.data, plan.W, plan.H);
    atlas = plan;
    const rest = plan.jobs.filter((j) => j.era !== ERA.NOW);
    let i = 0;
    const chunk = () => {
      drawJobs(plan, rest.slice(i, i + 14)); i += 14;
      if (i < rest.length) setTimeout(chunk, 16); else board.uploadAtlas(plan.data, plan.W, plan.H);
    };
    setTimeout(chunk, 400);
  }
  measure();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
  mobileQ.addEventListener('change', measure);
  if (reduced) root.classList.add('intro-done');
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
}
start();
