// Procedural geometry. Most parts are one primitive: a profile swept around a rounded rectangle (keycaps, case,
// switch housings, plate, PCB, foam). Plus a helix for the spring and a lathe for the knob. Every mesh is a
// closed solid where it matters (the keycap shell is cut open in the macro scene), with outward normals and a
// winding that agrees with them.

const TAU = Math.PI * 2;

// Rounded rectangle, half extents hx/hz, corner radius R. A profile row is {d, y, nd, ny, tag}: d is an offset
// outward from the outline, (nd, ny) the normal in the (outward, up) plane. Rows with the same d/y and
// different normals make a crease.
export function sweep(hx, hz, R, profile, { nc = 5, seg = 0.3, rmin = 0.004, yfn = null, nfn = null, zfn = null } = {}) {
  const path = [];
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const a0 = (k * Math.PI) / 2;
    for (let i = 0; i < nc; i++) { const a = a0 + (i / nc) * (Math.PI / 2); path.push({ k, a, t: -1 }); }
    // straight edge from the end of corner k to the start of corner k+1
    const len = k % 2 === 0 ? 2 * hx : 2 * hz;
    const n = Math.max(1, Math.ceil(len / seg));
    for (let i = 0; i < n; i++) path.push({ k, a: a0 + Math.PI / 2, t: i / n });
  }
  const pt = (s, d) => {
    // the radius never exceeds the outline itself, so the innermost ring closes to a point or a line
    const r = Math.min(Math.max(R + d, rmin), Math.max(0, Math.min(hx + d, hz + d)));
    const ex = hx + d - r, ez = hz + d - r;
    const arc = (k, a) => [corners[k][0] * Math.max(ex, 0) + r * Math.cos(a), corners[k][1] * Math.max(ez, 0) + r * Math.sin(a)];
    if (s.t < 0) return { p: arc(s.k, s.a), n: [Math.cos(s.a), Math.sin(s.a)] };
    const A = arc(s.k, s.a), B = arc((s.k + 1) % 4, s.a);
    return { p: [A[0] + (B[0] - A[0]) * s.t, A[1] + (B[1] - A[1]) * s.t], n: [Math.cos(s.a), Math.sin(s.a)] };
  };
  const pos = [], nrm = [], tag = [], idx = [];
  const W = path.length;
  for (const row of profile) {
    for (const s of path) {
      const q = pt(s, row.d);
      let x = q.p[0], z = q.p[1];
      let y = yfn ? yfn(x, z, row) : row.y;
      if (zfn) z += zfn(y, row);
      let n = [q.n[0] * row.nd, row.ny, q.n[1] * row.nd];
      if (nfn) n = nfn(x, z, row, n);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      pos.push(x, y, z); nrm.push(n[0] / l, n[1] / l, n[2] / l); tag.push(row.tag || 0);
    }
  }
  for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < W; i++) {
    const a = j * W + i, b = j * W + ((i + 1) % W), c = a + W, d = b + W;
    idx.push(a, b, d, a, d, c);
  }
  return orient(pos, nrm, tag, idx);
}

// flip every triangle whose winding disagrees with its vertex normals; drop degenerate ones
function orient(pos, nrm, tag, idx) {
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const pa = P(a), pb = P(b), pc = P(c);
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const g = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(g[0], g[1], g[2]) < 1e-9) continue;
    const s = [0, 1, 2].map((k) => nrm[a * 3 + k] + nrm[b * 3 + k] + nrm[c * 3 + k]);
    if (g[0] * s[0] + g[1] * s[1] + g[2] * s[2] < 0) out.push(a, c, b); else out.push(a, b, c);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), tag: new Float32Array(tag), idx: new Uint32Array(out), count: out.length };
}

const crease = (rows) => rows; // readability: consecutive rows with equal d/y and different normals

// ---------------------------------------------------------------- keycap
// A hollow shell (1.4 mm wall) with a tapered skirt, a rounded top edge and a cylindrical dish. Origin at the
// centre of its bottom rim; height KH (rows rescale it in the shader). tag: 1 = top surface (legend), 2 = shell
// interior, 0 = outside wall.
export const KH = 0.44, KGAP = 0.045, KTI = 0.14, KTH = 0.075, KRR = 0.05;
export function keycap(w) {
  const hx = (w - KGAP) / 2, hz = (1 - KGAP) / 2;
  const tx = hx - KTI, tz = hz - KTI; // top half extents
  const dd = w >= 6 ? 0.012 : 0.028;
  const dish = (x) => dd * Math.max(0, 1 - (x / tx) ** 2);
  const wall = norm2(KH - KRR, KTI - KRR); // outward normal of the skirt
  const inner = norm2(KH - KTH, KTI + KTH / 2 - KTH);
  const prof = [];
  const cz = Math.min(tx, tz);
  // inner ceiling, from the centre out (normal down, into the hollow)
  const dc0 = -(hz - 0.001), dc1 = -KTI - KTH / 2;
  for (const f of [0, 0.4, 0.75, 1]) prof.push({ d: dc0 + (dc1 - dc0) * f, y: KH - KTH, nd: 0, ny: -1, tag: 2 });
  crease(prof.push({ d: -KTI - KTH / 2, y: KH - KTH, nd: -inner[0], ny: -inner[1], tag: 2 }));
  prof.push({ d: -KTH, y: 0, nd: -inner[0], ny: -inner[1], tag: 2 });
  crease(prof.push({ d: -KTH, y: 0, nd: 0, ny: -1, tag: 0 }));
  prof.push({ d: 0, y: 0, nd: 0, ny: -1, tag: 0 });
  crease(prof.push({ d: 0, y: 0, nd: wall[0], ny: wall[1], tag: 0 }));
  for (const f of [0.35, 0.7]) prof.push({ d: -(KTI - KRR) * f, y: (KH - KRR) * f, nd: wall[0], ny: wall[1], tag: 0 });
  // rounded top edge
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    const nd = Math.cos(a) * (i === 0 ? wall[0] : 1), ny = Math.sin(a) + (i === 0 ? wall[1] : 0);
    prof.push({ d: -KTI + KRR * Math.cos(a), y: KH - KRR + KRR * Math.sin(a), nd, ny, tag: i === 5 ? 1 : 0 });
  }
  // top, ring by ring to the middle
  for (const f of [0.08, 0.2, 0.36, 0.55, 0.75, 0.9, 0.999]) prof.push({ d: -KTI - cz * f, y: KH, nd: 0, ny: 1, tag: 1 });
  const zs = (y) => -0.025 * (y / KH); // the top sits a little towards the back
  const shell = sweep(hx, hz, 0.06, prof, {
    nc: 4, seg: 0.25, rmin: 0.03,
    zfn: (y) => zs(y),
    yfn: (x, z, r) => (r.y > KH - KRR - 1e-6 || r.tag === 2 && r.ny < -0.9 ? r.y - dish(x) : r.y),
    nfn: (x, z, r, n) => {
      if (r.y < KH - KRR - 1e-6 && !(r.tag === 2 && r.ny < -0.9)) return n;
      const s = Math.abs(x) < tx ? (dd * 2 * x) / (tx * tx) : 0; // dy/dx of the dished surface
      return [n[0] - s * n[1], n[1], n[2]];
    },
  });
  // the socket that grips the stem's cross: a tube from the ceiling down to just above the rim
  const sockets = w >= 2 ? [0, -w / 2 + 0.6, w / 2 - 0.6].slice(0, w >= 6 ? 3 : 1) : [0];
  const tubes = sockets.map((cx) => tube(cx, -0.012, 0.15, 0.072, 0.1, KH - KTH + 0.01));
  return Object.assign(merge([shell, ...tubes]), { tx, tz, hx, hz, w });
}
function tube(cx, cz, R, r, y0, y1) {
  const prof = [
    { r, y: y1, nr: -1, ny: 0 }, { r, y: y0 + 0.01, nr: -1, ny: 0 }, { r, y: y0, nr: 0, ny: -1 }, { r: R, y: y0, nr: 0, ny: -1 },
    { r: R, y: y0, nr: 1, ny: 0 }, { r: R, y: y1, nr: 1, ny: 0 },
  ];
  const seg = 28, pos = [], nrm = [], tag = [], idx = [];
  for (const p of prof) for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
    pos.push(cx + c * p.r, p.y, cz + s * p.r); nrm.push(p.nr * c, p.ny, p.nr * s); tag.push(2);
  }
  const W = seg + 1;
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * W + i; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
  return orient(pos, nrm, tag, idx);
}
function norm2(a, b) { const l = Math.hypot(a, b); return [a / l, b / l]; }

// ---------------------------------------------------------------- case
// Two-piece look in one solid: outer wall with a diamond-cut chamfer, a flat top rim, a small inner chamfer,
// the well the keys sit in, and a wedge bottom (6° typing angle) generated in the plate's frame.
export const CASE = { hx: 8.55, hz: 3.675, R: 0.34, rim: 0.3, bez: 0.55, angle: (6 * Math.PI) / 180, floor: -0.62 };
export function caseMesh() {
  const C = CASE, ch = 0.075, ic = 0.035;
  const tanA = Math.tan(C.angle);
  const bottom = (z) => -1.05 + z * tanA;
  const prof = [];
  for (const d of [-C.hz + 0.02, -2.4, -1.2, -0.4, -0.06]) prof.push({ d, y: 0, nd: 0, ny: -1, bot: 1 });
  prof.push({ d: -0.02, y: 0, nd: 0.3, ny: -1, bot: 1 });
  prof.push({ d: 0, y: 0.03, nd: 1, ny: -0.3, bot: 1 });
  prof.push({ d: 0, y: 0.06, nd: 1, ny: 0, bot: 1 });
  prof.push({ d: 0, y: C.rim - ch, nd: 1, ny: 0 });
  prof.push({ d: 0, y: C.rim - ch, nd: 1, ny: 1, cham: 1 });
  prof.push({ d: -ch, y: C.rim, nd: 1, ny: 1, cham: 1 });
  prof.push({ d: -ch, y: C.rim, nd: 0, ny: 1 });
  prof.push({ d: -C.bez / 2, y: C.rim, nd: 0, ny: 1 });
  prof.push({ d: -C.bez + ic, y: C.rim, nd: 0, ny: 1 });
  prof.push({ d: -C.bez + ic, y: C.rim, nd: -1, ny: 1, cham: 1 });
  prof.push({ d: -C.bez, y: C.rim - ic, nd: -1, ny: 1, cham: 1 });
  prof.push({ d: -C.bez, y: C.rim - ic, nd: -1, ny: 0 });
  prof.push({ d: -C.bez, y: C.floor, nd: -1, ny: 0 });
  prof.push({ d: -C.bez, y: C.floor, nd: 0, ny: 1 });
  for (const d of [-C.bez - 0.6, -C.hz + 0.02]) prof.push({ d, y: C.floor, nd: 0, ny: 1 });
  prof.forEach((r) => { r.tag = r.cham ? 1 : r.y === C.floor ? 2 : 0; });
  return sweep(C.hx, C.hz, C.R, prof, {
    nc: 8, seg: 0.6, rmin: 0.1,
    yfn: (x, z, r) => (r.bot ? bottom(z) + r.y : r.y),
  });
}

// ---------------------------------------------------------------- flat slabs (plate, PCB, foam)
export function slab(hx, hz, R, h, { r = 0.02 } = {}) {
  const prof = [
    { d: -Math.min(hx, hz) + 0.01, y: 0, nd: 0, ny: -1 }, { d: -r, y: 0, nd: 0, ny: -1 },
    { d: 0, y: r, nd: 1, ny: -0.6 }, { d: 0, y: h - r, nd: 1, ny: 0.6 },
    { d: -r, y: h, nd: 0, ny: 1, tag: 1 }, { d: -Math.min(hx, hz) + 0.01, y: h, nd: 0, ny: 1, tag: 1 },
  ];
  return sweep(hx, hz, R, prof, { nc: 6, seg: 1.0, rmin: 0.02 });
}

// ---------------------------------------------------------------- switch
// Proportions of an MX-style switch in key units. Plate top is y = 0.
export const SW = { top: 0.3, stemTop: 0.5, travel: 0.21 };
export function housingTop() {
  const prof = [];
  prof.push({ d: -0.36, y: 0, nd: 0, ny: -1 });
  prof.push({ d: 0, y: 0, nd: 0, ny: -1 });
  prof.push({ d: 0, y: 0, nd: 1, ny: 0.15 });
  prof.push({ d: 0, y: 0.08, nd: 1, ny: 0.15 });
  prof.push({ d: -0.07, y: SW.top - 0.02, nd: 1, ny: 0.4 });
  prof.push({ d: -0.09, y: SW.top, nd: 0.3, ny: 1 });
  prof.push({ d: -0.12, y: SW.top, nd: 0, ny: 1, tag: 1 });
  prof.push({ d: -0.36, y: SW.top, nd: 0, ny: 1, tag: 1 });
  return sweep(0.39, 0.39, 0.06, prof, { nc: 4, seg: 0.4, rmin: 0.02 });
}
export function housingBottom() {
  const prof = [
    { d: -0.34, y: -0.27, nd: 0, ny: -1 }, { d: 0, y: -0.27, nd: 0, ny: -1 }, { d: 0, y: -0.27, nd: 1, ny: 0 },
    { d: 0, y: 0, nd: 1, ny: 0 }, { d: 0, y: 0, nd: 0, ny: 1 }, { d: -0.34, y: 0, nd: 0, ny: 1 },
  ];
  return sweep(0.36, 0.36, 0.04, prof, { nc: 3, seg: 0.4, rmin: 0.02 });
}
export function box(hx, hy, hz, cy = 0, r = 0.012) {
  const prof = [
    { d: -Math.min(hx, hz) + 0.002, y: cy - hy, nd: 0, ny: -1 }, { d: -r, y: cy - hy, nd: 0, ny: -1 },
    { d: 0, y: cy - hy + r, nd: 1, ny: -0.5 }, { d: 0, y: cy + hy - r, nd: 1, ny: 0.5 },
    { d: -r, y: cy + hy, nd: 0, ny: 1 }, { d: -Math.min(hx, hz) + 0.002, y: cy + hy, nd: 0, ny: 1 },
  ];
  return sweep(hx, hz, r * 1.5, prof, { nc: 2, seg: 1, rmin: 0.004 });
}
// the stem: a body inside the housing and the cross the keycap grips
export function stem() {
  return merge([box(0.13, 0.15, 0.09, 0.14, 0.015), box(0.11, 0.1, 0.034, SW.stemTop - 0.1, 0.008), box(0.034, 0.1, 0.11, SW.stemTop - 0.1, 0.008)]);
}
// unit spring: coils of a tube along a helix from y = 0 to y = 1 (scaled in the shader), closed ground ends
export function spring(coils = 9, R = 0.115, r = 0.013) {
  const steps = coils * 28, ring = 8;
  const pos = [], nrm = [], tag = [], idx = [];
  // ends are closed (dead coils): the pitch is small in the first and last coil
  const e = 1 / coils, wgt = (u) => (u < e || u > 1 - e ? 0.12 : 1);
  const Y = [0];
  for (let i = 1; i <= steps; i++) Y.push(Y[i - 1] + wgt((i - 0.5) / steps));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const th = u * coils * TAU;
    const c = [Math.cos(th) * R, Y[i] / Y[steps], Math.sin(th) * R];
    const T = norm3([-Math.sin(th) * R * coils * TAU, 1, Math.cos(th) * R * coils * TAU]);
    const N = [Math.cos(th), 0, Math.sin(th)];
    const B = cross3(T, N);
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * TAU;
      const n = [N[0] * Math.cos(a) + B[0] * Math.sin(a), N[1] * Math.cos(a) + B[1] * Math.sin(a), N[2] * Math.cos(a) + B[2] * Math.sin(a)];
      pos.push(c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r); nrm.push(...n); tag.push(c[1]);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < ring; j++) {
    const a = i * ring + j, b = i * ring + ((j + 1) % ring), c2 = a + ring, d = b + ring;
    idx.push(a, b, d, a, d, c2);
  }
  return orient(pos, nrm, tag, idx);
}
// knob: lathed cylinder with knurled flutes
export function knob(R = 0.36, h = 0.62, flutes = 48, amp = 0.012) {
  const prof = [];
  prof.push({ r: 0, y: h, nr: 0, ny: 1 });
  prof.push({ r: R * 0.55, y: h, nr: 0, ny: 1 });
  prof.push({ r: R * 0.6, y: h - 0.012, nr: 0.3, ny: 1 });
  prof.push({ r: R * 0.6, y: h - 0.012, nr: 0, ny: 1 });
  prof.push({ r: R - 0.03, y: h, nr: 0, ny: 1 });
  prof.push({ r: R, y: h - 0.03, nr: 1, ny: 1 });
  prof.push({ r: R, y: h - 0.05, nr: 1, ny: 0, side: 1 });
  prof.push({ r: R, y: 0.03, nr: 1, ny: 0, side: 1 });
  prof.push({ r: R - 0.03, y: 0, nr: 1, ny: -1 });
  prof.push({ r: 0, y: 0, nr: 0, ny: -1 });
  const seg = 192;
  const pos = [], nrm = [], tag = [], idx = [];
  for (const p of prof) for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
    const f = p.side ? amp * Math.cos(flutes * th) : 0;
    const r = p.r + f;
    let nx = p.nr * c, nz = p.nr * s;
    if (p.side) { const k = (-amp * flutes * Math.sin(flutes * th)) / r; nx -= k * -s; nz -= k * c; }
    const l = Math.hypot(nx, p.ny, nz) || 1;
    pos.push(c * r, p.y, s * r); nrm.push(nx / l, p.ny / l, nz / l); tag.push(p.side ? 1 : 0);
  }
  const W = seg + 1;
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return orient(pos, nrm, tag, idx);
}
// pins and posts under the switch
export function pins() {
  const parts = [];
  const cyl = (x, z, r, y0, y1) => {
    const n = 12, pos = [], nrm = [], tag = [], idx = [];
    for (const [y, ny] of [[y0, -1], [y0, 0], [y1, 0], [y1, 1]]) for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = ny === 0 ? r : r * 0.98;
      pos.push(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr);
      nrm.push(ny ? 0 : Math.cos(a), ny, ny ? 0 : Math.sin(a)); tag.push(0);
    }
    for (let j = 0; j < 3; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
    return orient(pos, nrm, tag, idx);
  };
  parts.push(cyl(-0.2, -0.13, 0.022, -0.47, -0.27), cyl(0.13, -0.26, 0.022, -0.47, -0.27));
  return merge(parts);
}
export function merge(list) {
  let off = 0;
  const pos = [], nrm = [], tag = [], idx = [];
  for (const m of list) {
    pos.push(...m.pos); nrm.push(...m.nrm); tag.push(...m.tag);
    for (const i of m.idx) idx.push(i + off);
    off += m.pos.length / 3;
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), tag: new Float32Array(tag), idx: new Uint32Array(idx), count: idx.length };
}
// a unit quad in x/z for shadows and light pools
export function quad() {
  return { pos: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), nrm: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), tag: new Float32Array(4), idx: new Uint32Array([0, 2, 1, 0, 3, 2]), count: 6 };
}
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
