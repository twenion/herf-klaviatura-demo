// WebGL2 renderer for the keyboard. Everything is rasterised at full device resolution with MSAA: backdrop,
// soft ground shadow, case, foam, PCB, brass plate, 82 switches (housings, stems, springs, pins), the knob and
// 82 keycaps drawn instanced per width. Legends come from a signed-distance-field atlas, so they stay sharp in
// the macro shots. Colours are linear; the output is gamma-encoded.
import { keycap, caseMesh, slab, housingTop, housingBottom, stem, spring, knob, pins, quad, KH, CASE, SW } from './geo.js';
import { KEYS, WIDTHS, ROW_H, ROW_SLOPE, KNOB } from './layout.js';
import { CAP, ERA_INK } from './theme.js';

const HEAD = `#version 300 es
precision highp float;`;

const CAMERA = `
uniform vec3 uCam, uU, uV, uW; uniform float uFocal, uAspect; uniform vec2 uOff;
uniform mat3 uRot; uniform vec3 uPos; uniform float uScale;
vec4 project(vec3 wp){
  vec3 d = wp - uCam;
  float z = dot(d, uW), x = dot(d, uU), y = dot(d, uV);
  const float n = .05, f = 200.;
  return vec4((x * uFocal + uOff.x * z) * 2. / uAspect, (y * uFocal + uOff.y * z) * 2., z * (f + n) / (f - n) - 2. * f * n / (f - n), z);
}
vec3 toWorld(vec3 lp){ return uPos + uRot * (lp * uScale); }
`;

const LIGHT = `
uniform vec3 uCam, uEnvTop, uEnvBot, uKey;
uniform float uTime, uEnvBase;
uniform vec4 uRip[8];
uniform vec3 uRipCol;
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), b = mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x);
  float c = mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), d = mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
// studio: a large softbox up-left, a strip right, a top light, a low front fill
vec3 env(vec3 d, float r){
  vec3 c = mix(uEnvBot, uEnvTop, smoothstep(-.5, .85, d.y)) * uEnvBase;
  float az = atan(d.x, d.z);
  float w = .12 + r * 1.3;
  float k1 = smoothstep(w * 1.6, 0., abs(az + .75)) * smoothstep(.05 - r, .35, d.y) * smoothstep(.97, .7 - r, d.y);
  float k2 = smoothstep(w * .6, 0., abs(az - 1.35)) * smoothstep(-.2 - r, .1, d.y) * smoothstep(.9, .55 - r, d.y);
  float top = smoothstep(.7 - r, .97, d.y);
  float fill = smoothstep(1.1, 0., abs(az)) * smoothstep(-.3, .3, d.y) * smoothstep(.75, .35, d.y);
  return c + uKey * (k1 * 1.6 + k2 * 1.25 + top * .9 + fill * .18);
}
const vec3 L1 = normalize(vec3(-.55, .8, .45)), L2 = normalize(vec3(.8, .45, -.1)), L3 = normalize(vec3(.1, .3, 1.));
vec3 keys(vec3 n, vec3 v, float sh){
  return uKey * (pow(max(dot(n, normalize(L1 + v)), 0.), sh) * 1.6 + pow(max(dot(n, normalize(L2 + v)), 0.), sh) * 1.1 + pow(max(dot(n, normalize(L3 + v)), 0.), sh * .6) * .35);
}
vec3 diffuse(vec3 n){
  vec3 amb = mix(uEnvBot, uEnvTop, n.y * .5 + .5);
  return amb * .5 + uKey * (max(dot(n, L1), 0.) * .78 + max(dot(n, L2), 0.) * .3 + max(dot(n, L3), 0.) * .12);
}
// light rings spreading from pressed keys (board-local x/z)
float ripple(vec2 p){
  float s = 0.;
  for (int i = 0; i < 8; i++){
    vec4 r = uRip[i];
    if (r.w <= 0.) continue;
    float age = r.z;
    float d = length(p - r.xy);
    float a = r.w * exp(-age * 2.6) * .32;
    s += a * exp(-pow((d - age * 7.) / (.28 + age * .5), 2.)) + r.w * 1.2 * exp(-d * d * 4.) * exp(-age * 9.);
  }
  return s;
}
vec3 outc(vec3 c){ return pow(max(c, 0.), vec3(1. / 2.2)); }
`;

const VS_QUAD = `${HEAD}
in vec3 aPos;
void main(){ gl_Position = vec4(aPos.xy, 0., 1.); }`;

const FS_BG = `${HEAD}
out vec4 fragColor;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uBgTop, uBgBot, uWordCol;
uniform sampler2D uWords; uniform float uRows;
uniform vec4 uWordA, uWordIdx, uWordX; uniform float uWordY, uWordH;
uniform float uFlash;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 c = mix(uBgBot, uBgTop, smoothstep(-.65, .55, uv.y));
  c *= 1. - .1 * smoothstep(.4, 1.3, length(uv * vec2(.8, 1.)));
  float m = 0.;
  float aspect = 4.;
  for (int i = 0; i < 4; i++){
    float a = uWordA[i];
    if (a < .002) continue;
    vec2 t = (uv - vec2(uWordX[i], uWordY)) / vec2(uWordH * aspect, uWordH) + .5;
    if (t.x < 0. || t.x > 1. || t.y < 0. || t.y > 1.) continue;
    m = max(m, texture(uWords, vec2(t.x, (uWordIdx[i] + 1. - t.y) / uRows)).r * a);
  }
  c = mix(c, uWordCol, m);
  c += uFlash * .25 * exp(-dot(uv, uv) * 2.);
  float g = hash(floor(gl_FragCoord.xy)) - .5;
  c += g * .018 * (c + .05);
  fragColor = vec4(pow(max(c, 0.), vec3(1. / 2.2)), 1.);
}`;

// ---------------------------------------------------------------- keycaps
const VS_CAP = `${HEAD}
in vec3 aPos; in vec3 aNrm; in float aTag;
in vec4 iA; in vec4 iB; in vec4 iC; in vec4 iD; in vec4 iE; in vec4 iF; in vec4 iG;
${CAMERA}
uniform vec2 uTop; uniform float uKH, uBase, uTravel, uCapsUp, uOne, uOneUp;
out vec3 vW, vN, vL, vB; out vec2 vUV; out float vTag;
flat out vec4 vRectA, vRectB, vInfo, vMix; flat out vec3 vOrigin;
mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 ry(float a){ float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rz(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }
void main(){
  if (iC.z < .5){ gl_Position = vec4(0., 0., 2., 1.); return; }
  float rowH = iA.z, slope = iA.w, sy = rowH / uKH;
  vec3 p = aPos, n = normalize(vec3(aNrm.x, aNrm.y / sy, aNrm.z));
  p.y *= sy;
  float wt = smoothstep(.3, 1., p.y / rowH);
  p.y += slope * p.z * wt;
  n = normalize(vec3(n.x, n.y, n.z - slope * wt * n.y));
  vL = p; vTag = aTag;
  vUV = vec2(aPos.x / (2. * uTop.x) + .5, (aPos.z + .025) / (2. * uTop.y) + .5);
  mat3 R = ry(iB.w) * rx(iB.y) * rz(iB.z);
  vec3 c = vec3(0., rowH * .5, 0.);
  p = R * (p - c) + c; n = R * n;
  float up = uCapsUp + (abs(iG.x - uOne) < .5 ? uOneUp : 0.);
  vOrigin = vec3(iA.x, uBase + iB.x - iC.x * uTravel + up, iA.y);
  vec3 lp = vOrigin + p;
  vB = lp;
  vW = toWorld(lp); vN = uRot * n;
  vRectA = iD; vRectB = iE; vInfo = vec4(iC.y, iC.w, iF.x, iF.y); vMix = vec4(iF.z, iF.w, iG.y, rowH);
  gl_Position = project(vW);
}`;

const FS_CAP = `${HEAD}
out vec4 fragColor;
${LIGHT}
uniform mat3 uRot; uniform vec3 uPos; uniform float uScale;
uniform sampler2D uAtlas;
uniform vec3 uCapCol[3]; uniform vec3 uInkLight; uniform vec3 uEraInk[5];
uniform vec2 uTop; uniform float uCutX, uKTH, uGlowAll;
in vec3 vW, vN, vL, vB; in vec2 vUV; in float vTag;
flat in vec4 vRectA, vRectB, vInfo, vMix; flat in vec3 vOrigin;
float sdfAt(vec4 rect, vec2 uv){
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) return 0.;
  return texture(uAtlas, mix(rect.xy, rect.zw, uv)).r;
}
void main(){
  float kind = vInfo.x, acc = vInfo.y;
  bool second = vMix.x > .5;
  vec4 rect = second ? vRectB : vRectA;
  int era = int(second ? vInfo.w : vInfo.z);
  vec3 base = mix(kind < .5 ? uCapCol[0] : uCapCol[1], uCapCol[2], acc);
  vec3 ink = mix(uEraInk[era], uInkLight, max(kind, acc));
  float rowH = vMix.w;
  bool cut = vMix.z > .5;
  vec3 V = normalize(uCam - vW);
  if (cut){
    if (vL.x > uCutX) discard;
    if (!gl_FrontFacing){
      // the view ray, in the cap's own frame, meets the cutting plane here
      mat3 Rt = transpose(uRot);
      vec3 camL = Rt * (uCam - uPos) / uScale - vOrigin;
      vec3 frL = Rt * (vW - uPos) / uScale - vOrigin;
      float t = (uCutX - camL.x) / (frL.x - camL.x);
      vec3 pc = camL + (frL - camL) * t;
      vec2 uv = vec2(pc.x / (2. * uTop.x) + .5, (pc.z + .025) / (2. * uTop.y) + .5);
      float top = rowH - uKTH * rowH / .44 - .006;
      float band = step(top, pc.y);
      float d = sdfAt(rect, uv);
      float w = fwidth(d) * .8 + 1e-4;
      float leg = band * smoothstep(.75 - w, .75 + w, d);
      vec3 sc = mix(base * 1.3 + .035, ink, leg);
      float grain = noise3(pc * 300.) * .06;
      vec3 col = sc * (.95 + grain) * (uEnvTop * .55 + uKey * .5);
      fragColor = vec4(outc(col), 1.);
      return;
    }
  }
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float legend = 0.;
  if (vTag > .98){
    float d = sdfAt(rect, vUV);
    float w = fwidth(d) * .75 + 1e-4;
    legend = smoothstep(.75 - w, .75 + w, d);
  }
  vec3 alb = mix(base, ink, legend);
  float grain = noise3(vL * 260.) * .5 + noise3(vL * 61.) * .5;
  alb *= .97 + .06 * grain;
  float ao = mix(.42, 1., smoothstep(0., rowH * .85, vL.y));
  if (vTag > 1.5 && vTag < 2.5) ao *= .62;
  vec3 col = alb * diffuse(N) * ao;
  float F = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
  col += env(reflect(-V, N), .45) * F * .18 * ao + keys(N, V, 22.) * .07 * (1. - legend * .4);
  float g = ripple(vB.xz) + uGlowAll;
  col += uRipCol * g * (1. - smoothstep(0., rowH * .5, vL.y)) * .8;
  fragColor = vec4(outc(col), 1.);
}`;

// ---------------------------------------------------------------- generic static mesh
const VS_MESH = `${HEAD}
in vec3 aPos; in vec3 aNrm; in float aTag;
${CAMERA}
uniform vec3 uOffset; uniform float uSpin; uniform vec3 uPivot;
out vec3 vW, vN, vL; out float vTag;
void main(){
  vec3 p = aPos, n = aNrm;
  if (uSpin != 0.){ float c = cos(uSpin), s = sin(uSpin); p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); n = vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z); }
  vL = aPos; vTag = aTag;
  vec3 lp = p + uPivot + uOffset;
  vW = toWorld(lp); vN = uRot * n;
  gl_Position = project(vW);
}`;

// anodised aluminium case, brass plate, knob
const FS_METAL = `${HEAD}
out vec4 fragColor;
${LIGHT}
uniform vec3 uBase, uEdge; uniform float uRough, uDye, uAO;
in vec3 vW, vN, vL; in float vTag;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
  float ndv = max(dot(N, V), 0.);
  vec3 R = reflect(-V, N);
  float brush = noise3(vec3(vL.x * 3., vL.y * 90., vL.z * 90.)) * .5 + noise3(vL * 400.) * .5;
  vec3 col;
  if (vTag > .5 && vTag < 1.5){
    // diamond-cut chamfer: bare aluminium, almost a mirror
    vec3 F = uEdge + (1. - uEdge) * pow(1. - ndv, 5.);
    col = env(R, .03) * F + keys(N, V, 900.) * 1.6;
  } else if (vTag > 1.5){
    col = uBase * .08;
  } else {
    vec3 F0 = mix(uBase, vec3(.9), .06);
    vec3 F = F0 + (1. - F0) * pow(1. - ndv, 5.);
    vec3 spec = env(R, uRough + brush * .04) * F;
    col = mix(spec, uBase * diffuse(N) + spec * .35, uDye) + keys(N, V, mix(260., 40., uRough)) * mix(uBase, vec3(1.), .55) * .55;
    col *= .94 + .1 * brush;
    col *= mix(.55, 1., smoothstep(-.9, .2, N.y));
  }
  col *= uAO;
  fragColor = vec4(outc(col), 1.);
}`;

// plastics and the PCB
const FS_PLASTIC = `${HEAD}
out vec4 fragColor;
${LIGHT}
uniform vec3 uBase; uniform float uGloss, uGlow, uFoam;
uniform sampler2D uPcb; uniform float uUsePcb; uniform vec4 uPcbRect;
in vec3 vW, vN, vL; in float vTag;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
  vec3 alb = uBase;
  float sh = mix(30., 220., uGloss);
  if (uUsePcb > .5 && N.y > .5){
    vec2 uv = (vL.xz - uPcbRect.xy) / uPcbRect.zw;
    vec4 t = texture(uPcb, uv);
    alb = mix(alb, t.rgb, t.a);
    sh = mix(40., 300., t.a * step(.5, t.r));
  }
  if (uFoam > .5){ float n = noise3(vL * 38.) * .6 + noise3(vL * 140.) * .4; alb *= .6 + .7 * n * n; }
  float F = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
  vec3 col = alb * diffuse(N) + env(reflect(-V, N), mix(.4, .03, uGloss)) * F * mix(.15, .7, uGloss) + keys(N, V, sh) * mix(.05, .5, uGloss);
  fragColor = vec4(outc(col), 1.);
}`;

// ---------------------------------------------------------------- switches (instanced)
const VS_SW = `${HEAD}
in vec3 aPos; in vec3 aNrm; in float aTag;
in vec4 iS;
${CAMERA}
uniform float uPart; // 0 housing top, 1 housing bottom, 2 stem, 3 spring, 4 pins
uniform float uTravel, uSwUp, uOne; uniform vec4 uOneOff; uniform float uOneFree;
out vec3 vW, vN, vL, vB; out float vTag; out float vPress;
void main(){
  if (iS.w < .5){ gl_Position = vec4(0., 0., 2., 1.); return; }
  float id = float(gl_InstanceID);
  bool one = abs(id - uOne) < .5;
  float press = iS.z;
  vec3 p = aPos;
  vec3 off = vec3(0., uSwUp, 0.);
  if (uPart == 2.){ off.y -= press * uTravel; if (one) off.y += uOneOff.y; }
  if (uPart == 0. && one) off.y += uOneOff.w;
  if (uPart == 3.){
    // the spring sits between the bottom housing floor and the stem
    float y0 = -.24, y1 = -.01 - press * uTravel;
    if (one){ y0 = mix(y0, uOneOff.z, step(.001, uOneFree)); y1 = mix(y1, uOneOff.z + uOneFree, step(.001, uOneFree)); }
    p.y = y0 + p.y * (y1 - y0);
  }
  if ((uPart == 1. || uPart == 4.) && one) off.y += uOneOff.x;
  vL = p; vTag = aTag; vPress = press;
  vec3 lp = vec3(iS.x, 0., iS.y) + p + off;
  vB = lp;
  vW = toWorld(lp); vN = uRot * aNrm;
  gl_Position = project(vW);
}`;

const FS_SW = `${HEAD}
out vec4 fragColor;
${LIGHT}
uniform vec3 uBase; uniform float uGloss, uMetal, uGlow;
in vec3 vW, vN, vL, vB; in float vTag; in float vPress;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
  float ndv = max(dot(N, V), 0.);
  vec3 col;
  if (uMetal > .5){
    vec3 F = uBase + (1. - uBase) * pow(1. - ndv, 5.);
    col = env(reflect(-V, N), .12) * F + keys(N, V, 160.) * uBase;
  } else {
    float F = .04 + .96 * pow(1. - ndv, 5.);
    col = uBase * diffuse(N) + env(reflect(-V, N), mix(.4, .02, uGloss)) * F * mix(.1, .8, uGloss) + keys(N, V, mix(30., 300., uGloss)) * mix(.05, .6, uGloss);
  }
  col += uRipCol * ripple(vB.xz) * uGlow * smoothstep(.0, .3, vL.y);
  fragColor = vec4(outc(col), 1.);
}`;

// soft shadows: one under the board, one per airborne key
const VS_SHADOW = `${HEAD}
in vec3 aPos;
in vec4 iA; in vec4 iB; in vec4 iC; in vec4 iD; in vec4 iE; in vec4 iF; in vec4 iG;
${CAMERA}
uniform float uGround, uTanA, uY;
uniform vec2 uHalf;
out vec2 vQ; out float vA;
void main(){
  vec3 lp;
  if (uGround > .5){
    lp = vec3(aPos.x * uHalf.x, 0., aPos.z * uHalf.y);
    lp.y = -1.05 + lp.z * uTanA - .004;
    vA = 1.;
  } else {
    float lift = iB.x;
    float s = .5 + lift * .09;
    lp = vec3(iA.x + aPos.x * (s + iG.z * .5 - .5), uY, iA.y + aPos.z * s);
    vA = iC.z * smoothstep(.03, .5, lift) * clamp(1.2 - lift / 7., 0., 1.);
  }
  vQ = aPos.xz;
  gl_Position = project(toWorld(lp));
}`;
const FS_SHADOW = `${HEAD}
out vec4 fragColor;
uniform float uGround, uAlpha; uniform vec2 uHalf; uniform vec2 uCore;
in vec2 vQ; in float vA;
void main(){
  float a;
  if (uGround > .5){
    vec2 p = abs(vQ * uHalf) - uCore;
    float d = length(max(p, 0.)) + min(max(p.x, p.y), 0.);
    a = exp(-pow(max(d + .35, 0.), 2.) * 1.1);
  } else {
    vec2 q = vQ; q.x /= 1.;
    a = exp(-dot(q, q) * 2.6) * vA;
  }
  a *= uAlpha;
  fragColor = vec4(0., 0., 0., a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
  return s;
}
const ATTR = ['aPos', 'aNrm', 'aTag', 'iA', 'iB', 'iC', 'iD', 'iE', 'iF', 'iG'];
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  ATTR.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.bindAttribLocation(p, 3, 'iS');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function rotMat(yaw, tilt, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt), cz = Math.cos(roll), sz = Math.sin(roll);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(mul(Ry, Rx), Rz);
}

export const CAP_BASE = 0.33; // keycap rim above the plate at rest
const KSTRIDE = 28;

export class Board {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    this.P = {
      bg: program(gl, VS_QUAD, FS_BG),
      cap: program(gl, VS_CAP, FS_CAP),
      metal: program(gl, VS_MESH, FS_METAL),
      plastic: program(gl, VS_MESH, FS_PLASTIC),
      sw: program(gl, VS_SW, FS_SW),
      shadow: program(gl, VS_SHADOW, FS_SHADOW),
    };
    // keys sorted by width class; one shared instance buffer
    this.order = KEYS.slice().sort((a, b) => a.wi - b.wi || a.i - b.i);
    this.kdata = new Float32Array(this.order.length * KSTRIDE);
    this.kbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.kbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.kdata.byteLength, gl.DYNAMIC_DRAW);
    this.sdata = new Float32Array(KEYS.length * 4);
    this.sbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.sdata.byteLength, gl.DYNAMIC_DRAW);

    this.caps = WIDTHS.map((w, wi) => {
      const m = keycap(w);
      const start = this.order.findIndex((k) => k.wi === wi);
      const count = this.order.filter((k) => k.wi === wi).length;
      return { m, vao: this.vao(m, { buf: this.kbuf, stride: KSTRIDE, first: start, locs: 7 }), count, tx: m.tx, tz: m.tz };
    });
    const st = (m, inst) => ({ vao: this.vao(m, inst), count: m.count });
    const sInst = { buf: this.sbuf, stride: 4, first: 0, locs: 1 };
    this.M = {
      case: st(caseMesh()),
      plate: st(slab(8.2, 3.3, 0.12, 0.06)),
      pcb: st(slab(8.12, 3.24, 0.1, 0.08)),
      foam: st(slab(8.05, 3.18, 0.1, 0.18)),
      knob: st(knob()),
      hTop: st(housingTop(), sInst),
      hBot: st(housingBottom(), sInst),
      stem: st(stem(), sInst),
      spring: st(spring(), sInst),
      pins: st(pins(), sInst),
      quad: st(quad()),
      shadowKeys: st(quad(), { buf: this.kbuf, stride: KSTRIDE, first: 0, locs: 7 }),
    };
    this.bg = this.vao({ pos: new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), nrm: new Float32Array(9), tag: new Float32Array(3), idx: new Uint32Array([0, 1, 2]), count: 3 });
    this.tex = { atlas: this.texture(), words: this.texture(), pcb: this.texture() };
    this.atlasReady = false;
  }

  vao(m, inst) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const put = (arr, loc, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    put(m.pos, 0, 3); put(m.nrm, 1, 3); put(m.tag, 2, 1);
    if (inst) {
      gl.bindBuffer(gl.ARRAY_BUFFER, inst.buf);
      for (let i = 0; i < inst.locs; i++) {
        gl.enableVertexAttribArray(3 + i);
        gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, inst.stride * 4, (inst.first * inst.stride + i * 4) * 4);
        gl.vertexAttribDivisor(3 + i, 1);
      }
    }
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return vao;
  }

  texture() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  uploadAtlas(data, w, h) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex.atlas);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    this.atlasReady = true;
  }
  uploadImage(name, source, mip = true) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex[name]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  }

  resize(cssW, cssH, pixelScale) {
    const w = Math.max(2, Math.round(cssW * pixelScale)), h = Math.max(2, Math.round(cssH * pixelScale));
    this.cssW = cssW; this.cssH = cssH;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  camera(s) {
    const cam = [s.target[0] + Math.sin(s.orbit) * Math.cos(s.pitch) * s.dist, s.target[1] + Math.sin(s.pitch) * s.dist, s.target[2] + Math.cos(s.orbit) * Math.cos(s.pitch) * s.dist];
    const w = norm(sub(s.target, cam));
    const u = norm(cross(w, [0, 1, 0]));
    const v = cross(u, w);
    const focal = 1 / (2 * Math.tan((s.fov * Math.PI) / 360));
    return { cam, u, v, w, focal };
  }
  // board-local point -> [cssX, cssY, uvX, uvY, depth]
  project(s, lp, C = this.camera(s), R = rotMat(s.yaw, s.tilt, s.roll)) {
    const wp = [0, 1, 2].map((i) => s.pos[i] + s.scale * (R[i][0] * lp[0] + R[i][1] * lp[1] + R[i][2] * lp[2]));
    const d = sub(wp, C.cam);
    const z = Math.max(dot(d, C.w), 0.001);
    const ux = (dot(d, C.u) * C.focal) / z + s.off[0];
    const uy = (dot(d, C.v) * C.focal) / z + s.off[1];
    return [ux * this.cssH + this.cssW / 2, this.cssH / 2 - uy * this.cssH, ux, uy, z];
  }

  common(pr, s, C, R) {
    const gl = this.gl, u = pr.u, T = s.theme;
    gl.useProgram(pr.p);
    const v3 = (k, v) => u[k] && gl.uniform3fv(u[k], v);
    const v1 = (k, v) => u[k] && gl.uniform1f(u[k], v);
    u.uRes && gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    v1('uTime', s.time); v1('uAspect', this.cssW / this.cssH);
    v3('uCam', C.cam); v3('uU', C.u); v3('uV', C.v); v3('uW', C.w);
    v1('uFocal', C.focal);
    u.uOff && gl.uniform2fv(u.uOff, s.off);
    v3('uEnvTop', T.envTop); v3('uEnvBot', T.envBot); v3('uKey', T.key); v1('uEnvBase', 1);
    if (u.uRot) gl.uniformMatrix3fv(u.uRot, false, [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
    v3('uPos', s.pos); v1('uScale', s.scale);
    if (u.uRip) gl.uniform4fv(u.uRip, s.rip);
    v3('uRipCol', s.ripCol);
    return u;
  }

  // write per-key instance data
  writeKeys(K) {
    const d = this.kdata;
    this.order.forEach((k, j) => {
      const st = K[k.i];
      const o = j * KSTRIDE;
      d[o] = k.x; d[o + 1] = k.z; d[o + 2] = ROW_H[k.row]; d[o + 3] = ROW_SLOPE[k.row];
      d[o + 4] = st.lift; d[o + 5] = st.rx; d[o + 6] = st.rz; d[o + 7] = st.ry;
      d[o + 8] = st.press; d[o + 9] = k.kind === 'm' ? 1 : 0; d[o + 10] = st.vis; d[o + 11] = st.acc;
      d.set(st.rectA, o + 12); d.set(st.rectB, o + 16);
      d[o + 20] = st.eraA; d[o + 21] = st.eraB; d[o + 22] = st.flip; d[o + 23] = 0;
      d[o + 24] = k.i; d[o + 25] = st.cut; d[o + 26] = k.w; d[o + 27] = 0;
    });
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.kbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    const sd = this.sdata;
    KEYS.forEach((k, i) => { sd[i * 4] = k.x; sd[i * 4 + 1] = k.z; sd[i * 4 + 2] = K[i].swPress; sd[i * 4 + 3] = K[i].swVis; });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sd);
  }

  render(s, K) {
    const gl = this.gl, P = this.P, M = this.M;
    const C = this.camera(s);
    const R = rotMat(s.yaw, s.tilt, s.roll);
    const W = this.canvas.width, H = this.canvas.height;
    this.writeKeys(K);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    // backdrop
    let u = this.common(P.bg, s, C, R);
    gl.uniform3fv(u.uBgTop, s.theme.bgTop); gl.uniform3fv(u.uBgBot, s.theme.bgBot); gl.uniform3fv(u.uWordCol, s.theme.word);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.words); gl.uniform1i(u.uWords, 0);
    gl.uniform1f(u.uRows, s.wordRows);
    gl.uniform4fv(u.uWordA, s.wordA); gl.uniform4fv(u.uWordIdx, s.wordIdx); gl.uniform4fv(u.uWordX, s.wordX);
    gl.uniform1f(u.uWordY, s.wordY); gl.uniform1f(u.uWordH, s.wordH); gl.uniform1f(u.uFlash, s.flash || 0);
    gl.bindVertexArray(this.bg); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0);
    if (s.hidden) return { C, R };
    // ground shadow
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    u = this.common(P.shadow, s, C, R);
    gl.uniform1f(u.uGround, 1); gl.uniform1f(u.uTanA, Math.tan(CASE.angle)); gl.uniform2f(u.uHalf, CASE.hx + 1.6, CASE.hz + 1.6);
    gl.uniform2f(u.uCore, CASE.hx - 0.5, CASE.hz - 0.5); gl.uniform1f(u.uAlpha, s.shadow * 0.42);
    gl.bindVertexArray(M.quad.vao); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    const E = s.exp; // explode offsets
    const draw = (pr, m, off = [0, 0, 0], spin = 0, pivot = [0, 0, 0]) => {
      gl.uniform3fv(pr.u.uOffset, off); gl.uniform1f(pr.u.uSpin, spin); gl.uniform3fv(pr.u.uPivot, pivot);
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    };
    // case
    u = this.common(P.metal, s, C, R);
    gl.uniform3fv(u.uBase, s.caseCol.body); gl.uniform3fv(u.uEdge, s.caseCol.edge); gl.uniform1f(u.uRough, 0.32); gl.uniform1f(u.uDye, 0.72); gl.uniform1f(u.uAO, 1);
    gl.uniform1f(u.uEnvBase, 0.55); // metals see a studio with dark flags, not the bright page
    draw(P.metal, M.case);
    // knob (same metal, finer finish)
    gl.uniform1f(u.uRough, 0.18);
    draw(P.metal, M.knob, [0, 0.12 + E.sw, 0], s.knob, [KNOB.x, 0, KNOB.z]);
    // brass plate
    gl.uniform3fv(u.uBase, [0.46, 0.29, 0.09]); gl.uniform3fv(u.uEdge, [0.95, 0.78, 0.45]); gl.uniform1f(u.uRough, 0.2); gl.uniform1f(u.uDye, 0.55);
    gl.uniform1f(u.uAO, 1 - 0.87 * s.capCover * (1 - Math.min(1, (E.sw - E.plate) * 1.5 + E.caps * 0.5))); // under the caps the plate sits in shadow
    draw(P.metal, M.plate, [0, E.plate - 0.06, 0]);
    // foam, PCB
    u = this.common(P.plastic, s, C, R);
    gl.uniform1f(u.uUsePcb, 0); gl.uniform1f(u.uFoam, 1); gl.uniform3fv(u.uBase, [0.09, 0.09, 0.1]); gl.uniform1f(u.uGloss, 0.02);
    draw(P.plastic, M.foam, [0, E.foam - 0.6, 0]);
    gl.uniform1f(u.uFoam, 0); gl.uniform1f(u.uUsePcb, 1); gl.uniform3fv(u.uBase, [0.035, 0.04, 0.04]); gl.uniform1f(u.uGloss, 0.45);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex.pcb); gl.uniform1i(u.uPcb, 2);
    gl.uniform4f(u.uPcbRect, -8.12, -3.24, 16.24, 6.48);
    draw(P.plastic, M.pcb, [0, E.pcb - 0.4, 0]);
    // switches
    if (s.switches) {
      u = this.common(P.sw, s, C, R);
      gl.uniform1f(u.uTravel, SW.travel); gl.uniform1f(u.uSwUp, E.sw);
      gl.uniform1f(u.uOne, s.one.index); gl.uniform4fv(u.uOneOff, s.one.off); gl.uniform1f(u.uOneFree, s.one.free);
      const part = (m, k, base, gloss, metal = 0) => {
        gl.uniform1f(u.uPart, k); gl.uniform3fv(u.uBase, base); gl.uniform1f(u.uGloss, gloss); gl.uniform1f(u.uMetal, metal);
        gl.bindVertexArray(m.vao); gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0, KEYS.length);
      };
      gl.uniform1f(u.uGlow, 1);
      part(M.hTop, 0, [0.05, 0.05, 0.058], 0.85);
      gl.uniform1f(u.uGlow, 0);
      part(M.stem, 2, s.stemCol, 0.5);
      if (s.inner) {
        part(M.hBot, 1, [0.018, 0.018, 0.02], 0.15);
        part(M.spring, 3, [0.85, 0.66, 0.32], 0, 1);
        part(M.pins, 4, [0.9, 0.7, 0.35], 0, 1);
      }
    }
    // keycaps
    if (this.atlasReady) {
      u = this.common(P.cap, s, C, R);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.atlas); gl.uniform1i(u.uAtlas, 1);
      gl.uniform3fv(u.uCapCol, [...CAP.alpha, ...CAP.mod, ...CAP.accent]);
      gl.uniform3fv(u.uInkLight, CAP.light);
      gl.uniform3fv(u.uEraInk, s.eraInk.flat());
      gl.uniform1f(u.uKH, KH); gl.uniform1f(u.uBase, CAP_BASE + E.sw); gl.uniform1f(u.uTravel, SW.travel);
      gl.uniform1f(u.uCapsUp, E.caps); gl.uniform1f(u.uOne, s.one.index); gl.uniform1f(u.uOneUp, s.one.cap);
      gl.uniform1f(u.uCutX, s.cutX); gl.uniform1f(u.uKTH, 0.075); gl.uniform1f(u.uGlowAll, s.glowAll || 0);
      for (const c of this.caps) {
        if (!c.count) continue;
        gl.uniform2f(u.uTop, c.tx, c.tz);
        gl.bindVertexArray(c.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, c.m.count, gl.UNSIGNED_INT, 0, c.count);
      }
    }
    // shadows of airborne keys on the switch tops
    if (s.airShadows) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      u = this.common(P.shadow, s, C, R);
      gl.uniform1f(u.uGround, 0); gl.uniform1f(u.uY, SW.top + 0.012 + E.sw); gl.uniform1f(u.uAlpha, 0.5);
      gl.bindVertexArray(M.shadowKeys.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0, KEYS.length);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    return { C, R };
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export { ERA_INK };
