import * as THREE from 'three';
import { inject } from '@vercel/analytics';

/* ============================================================
   THE ILLUSION OF USER-CENTERED DESIGN
   Scroll-driven particle deck — Three.js + GSAP + Lenis
   ============================================================ */

// Initialize Vercel Web Analytics
inject();

gsap.registerPlugin(ScrollTrigger);

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('load', () => {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
});

const IS_MOBILE = window.innerWidth < 768;
const COUNT = IS_MOBILE ? 7000 : 14000;
const STAG = 0.35; // per-particle stagger amount (must match shader)
const IVORY = '#f2efe8';
const ACCENT = '#ff5b26';

/* ------------------------------------------------------------
   Shape generators — each returns Float32Array(COUNT * 3)
   ------------------------------------------------------------ */

const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8165;

// Fit an arbitrary list of [x,y,z,(group)] points to exactly COUNT particles.
// Points may carry a 4th "group" id used for hover-highlighting; if any do,
// the returned array gets a parallel .groups Float32Array attached.
function fitPoints(raw, jitter = 0.02) {
  const out = new Float32Array(COUNT * 3);
  const grp = new Float32Array(COUNT);
  let hasGroups = false;
  if (!raw.length) return sphere(); // safety net
  for (let i = 0; i < COUNT; i++) {
    const p = raw[(Math.random() * raw.length) | 0];
    out[i * 3] = p[0] + (Math.random() - 0.5) * jitter;
    out[i * 3 + 1] = p[1] + (Math.random() - 0.5) * jitter;
    out[i * 3 + 2] = p[2] + (Math.random() - 0.5) * jitter;
    if (p[3]) { grp[i] = p[3]; hasGroups = true; }
  }
  if (hasGroups) out.groups = grp;
  return out;
}

function linePts(ax, ay, bx, by, n, arr, z = 0, g = 0) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    arr.push([ax + (bx - ax) * t, ay + (by - ay) * t, z, g]);
  }
}
function circlePts(cx, cy, r, n, arr, z = 0, g = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    arr.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, g]);
  }
}
function arcPts(cx, cy, r, a0, a1, n, arr, z = 0, g = 0) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    arr.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, g]);
  }
}

// --- sphere (hero) ---
function sphere() {
  const out = new Float32Array(COUNT * 3);
  const R = 2.05;
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = phi * i;
    out[i * 3] = Math.cos(th) * rad * R;
    out[i * 3 + 1] = y * R;
    out[i * 3 + 2] = Math.sin(th) * rad * R;
  }
  return out;
}

// --- galaxy (final) ---
function galaxy() {
  const out = new Float32Array(COUNT * 3);
  const cx = Math.cos(-0.85), sx = Math.sin(-0.85);
  for (let i = 0; i < COUNT; i++) {
    const arm = i % 3;
    const r = Math.pow(Math.random(), 0.65) * 3.3;
    const ang = r * 1.75 + (arm * Math.PI * 2) / 3 + gauss() * 0.28;
    let x = Math.cos(ang) * r;
    let z = Math.sin(ang) * r;
    let y = gauss() * 0.16 * Math.max(0.2, 3.3 - r);
    // tilt around X so the disc faces the viewer at an angle
    const y2 = y * cx - z * sx;
    const z2 = y * sx + z * cx;
    out[i * 3] = x;
    out[i * 3 + 1] = y2;
    out[i * 3 + 2] = z2;
  }
  return out;
}

// --- text / glyph sampling via canvas ---
function sampleGlyph(text, { px = 520, weight = '700', family = '"Space Grotesk", sans-serif', targetH = 4, maxW = 6.8, jitterZ = 0.14 } = {}) {
  const cw = 2048, ch = 1024;
  const cnv = document.createElement('canvas');
  cnv.width = cw; cnv.height = ch;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.font = `${weight} ${px}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cw / 2, ch / 2);
  const data = ctx.getImageData(0, 0, cw, ch).data;

  const pts = [];
  let minX = cw, maxX = 0, minY = ch, maxY = 0;
  const stride = 3;
  for (let y = 0; y < ch; y += stride) {
    for (let x = 0; x < cw; x += stride) {
      if (data[(y * cw + x) * 4 + 3] > 110) {
        pts.push([x, y]);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (pts.length < 120) return null; // glyph failed to render

  const bw = maxX - minX || 1, bh = maxY - minY || 1;
  const s = Math.min(targetH / bh, maxW / bw);
  const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
  return pts.map(([x, y]) => [
    (x - ox) * s + (Math.random() - 0.5) * s * 1.5,
    -(y - oy) * s + (Math.random() - 0.5) * s * 1.5,
    (Math.random() - 0.5) * jitterZ,
  ]);
}

function glyphShape(text, opts, fallback) {
  const raw = sampleGlyph(text, opts);
  if (!raw) return fallback ? glyphShape(fallback.text, fallback.opts) : sphere();
  return fitPoints(raw, 0.01);
}

// --- five product icons drawn on canvas (timeline) ---
// Bold, filled silhouettes so the limited particle budget lands on clear
// shapes instead of scattering into fuzz. Group id 1-5 per product.
function icons() {
  const cw = 2600, ch = 640;
  const cnv = document.createElement('canvas');
  cnv.width = cw; cnv.height = ch;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 24;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const y = ch / 2;
  const cxs = [260, 780, 1300, 1820, 2340];

  // 1 — cassette tape (Walkman): bold body, solid label, punched reels
  let cx = cxs[0];
  ctx.beginPath(); ctx.roundRect(cx - 175, y - 112, 350, 224, 26); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cx - 122, y - 78, 244, 62, 14); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'destination-out';
  for (const rx of [-66, 66]) { ctx.beginPath(); ctx.arc(cx + rx, y - 47, 22, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - 98, y + 112); ctx.lineTo(cx - 72, y + 46);
  ctx.lineTo(cx + 72, y + 46); ctx.lineTo(cx + 98, y + 112);
  ctx.stroke();

  // 2 — iPhone: clean rounded slab, solid notch, home bar
  cx = cxs[1];
  ctx.beginPath(); ctx.roundRect(cx - 100, y - 186, 200, 372, 44); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cx - 36, y - 178, 72, 22, 11); ctx.fill();
  ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(cx - 36, y + 156); ctx.lineTo(cx + 36, y + 156); ctx.stroke();
  ctx.lineWidth = 24;

  // 3 — Airbnb Bélo: bold single stroke
  cx = cxs[2];
  ctx.beginPath();
  ctx.moveTo(cx, y - 156);
  ctx.bezierCurveTo(cx - 32, y - 156, cx - 36, y - 112, cx - 60, y - 44);
  ctx.bezierCurveTo(cx - 84, y + 20, cx - 120, y + 70, cx - 120, y + 104);
  ctx.bezierCurveTo(cx - 120, y + 148, cx - 80, y + 168, cx - 48, y + 154);
  ctx.bezierCurveTo(cx - 24, y + 144, cx - 8, y + 124, cx, y + 106);
  ctx.moveTo(cx, y - 156);
  ctx.bezierCurveTo(cx + 32, y - 156, cx + 36, y - 112, cx + 60, y - 44);
  ctx.bezierCurveTo(cx + 84, y + 20, cx + 120, y + 70, cx + 120, y + 104);
  ctx.bezierCurveTo(cx + 120, y + 148, cx + 80, y + 168, cx + 48, y + 154);
  ctx.bezierCurveTo(cx + 24, y + 144, cx + 8, y + 124, cx, y + 106);
  ctx.stroke();

  // 4 — car (Uber): bold silhouette, solid wheels
  cx = cxs[3];
  ctx.beginPath();
  ctx.moveTo(cx - 156, y + 70);
  ctx.lineTo(cx - 156, y + 30);
  ctx.quadraticCurveTo(cx - 150, y + 2, cx - 108, y - 2);
  ctx.lineTo(cx - 72, y - 6);
  ctx.quadraticCurveTo(cx - 34, y - 58, cx + 22, y - 58);
  ctx.quadraticCurveTo(cx + 84, y - 58, cx + 114, y - 10);
  ctx.lineTo(cx + 136, y - 4);
  ctx.quadraticCurveTo(cx + 160, y + 8, cx + 160, y + 34);
  ctx.lineTo(cx + 160, y + 70);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - 80, y + 70, 36, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 90, y + 70, 36, 0, 7); ctx.fill();

  // 5 — Netflix "N" (solid letterform)
  cx = cxs[4];
  ctx.fillRect(cx - 86, y - 152, 50, 304);
  ctx.fillRect(cx + 36, y - 152, 50, 304);
  ctx.beginPath();
  ctx.moveTo(cx - 86, y - 152); ctx.lineTo(cx - 36, y - 152);
  ctx.lineTo(cx + 86, y + 152); ctx.lineTo(cx + 36, y + 152);
  ctx.closePath(); ctx.fill();

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const raw = [];
  const s = 7.9 / cw;
  for (let py = 0; py < ch; py += 2) {
    for (let px = 0; px < cw; px += 2) {
      if (data[(py * cw + px) * 4 + 3] > 60) {
        raw.push([
          (px - cw / 2) * s,
          -(py - ch / 2) * s,
          (Math.random() - 0.5) * 0.09,
          1 + Math.min(4, Math.floor(px / 520)),      // hover group per product
        ]);
      }
    }
  }
  return fitPoints(raw, 0.006);
}

// --- bicycle family (live exercise, three beats) ---
// hover groups: 1 frame · 2 gears · 3 tires · 4 aero · 5 brakes
function bikeRaw() {
  const raw = [];
  const R = [-1.35, -0.55], F = [1.35, -0.55];        // axles
  const C = [0.08, -0.5], S = [-0.4, 0.62], H = [0.92, 0.58], HB = [1.02, 0.9];

  // wheels + spokes — "tires"
  for (const [wx, wy] of [R, F]) {
    circlePts(wx, wy, 0.78, 170, raw, 0, 3);
    circlePts(wx, wy, 0.72, 90, raw, 0, 3);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      linePts(wx, wy, wx + Math.cos(a) * 0.72, wy + Math.sin(a) * 0.72, 12, raw, 0, 3);
    }
  }
  // frame
  linePts(R[0], R[1], S[0], S[1], 40, raw, 0, 1);   // seat stay
  linePts(R[0], R[1], C[0], C[1], 40, raw, 0, 1);   // chain stay
  linePts(C[0], C[1], S[0], S[1], 40, raw, 0, 1);   // seat tube
  linePts(S[0], S[1], H[0], H[1], 44, raw, 0, 1);   // top tube
  linePts(C[0], C[1], H[0], H[1], 48, raw, 0, 1);   // down tube
  linePts(H[0], H[1], F[0], F[1], 40, raw, 0, 1);   // fork
  linePts(H[0], H[1], HB[0], HB[1], 16, raw, 0, 1); // stem
  linePts(HB[0], HB[1], 1.28, 0.98, 12, raw, 0, 1); // handlebar
  linePts(S[0], S[1], -0.4, 0.74, 8, raw, 0, 1);    // seat post
  linePts(-0.62, 0.74, -0.18, 0.74, 14, raw, 0, 1); // saddle
  circlePts(C[0], C[1], 0.2, 40, raw, 0, 2);        // chainring — "gears"
  linePts(C[0], C[1] - 0.2, R[0], R[1] - 0.12, 30, raw, 0, 2); // chain
  linePts(C[0], C[1] + 0.2, R[0], R[1] + 0.12, 30, raw, 0, 2);
  return raw;
}
const bikeFit = raw => fitPoints(raw.map(p => [p[0] * 1.35, p[1] * 1.35 + 0.1, p[2], p[3] || 0]), 0.03);

function bicycle() {
  return bikeFit(bikeRaw());
}

// what the room suggests — same bike, tuned: disc wheel, gears, streaks, brakes
function bikeTuned() {
  const raw = bikeRaw();
  for (let i = 0; i < 180; i++) {                      // aero disc rear wheel
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.66;
    raw.push([-1.35 + Math.cos(a) * rr, -0.55 + Math.sin(a) * rr, 0, 4]);
  }
  circlePts(0.08, -0.5, 0.31, 54, raw, 0, 2);          // bigger chainring
  circlePts(0.08, -0.5, 0.13, 24, raw, 0, 2);          // inner sprocket
  const streaks = [[0.9, -2.15], [0.45, -2.4], [-0.05, -2.25], [-0.5, -2.5], [-0.9, -2.2]];
  for (const [yy, x1] of streaks) {                    // aero speed streaks
    linePts(x1 - (0.55 + Math.random() * 0.5), yy, x1, yy, 22, raw, 0, 4);
  }
  for (const wx of [-1.35, 1.35]) {                    // brake calipers atop rims
    linePts(wx - 0.18, -0.55 + 0.92, wx, -0.55 + 0.8, 10, raw, 0, 5);
    linePts(wx + 0.18, -0.55 + 0.92, wx, -0.55 + 0.8, 10, raw, 0, 5);
  }
  linePts(1.02, 0.9, 1.35, 0.4, 14, raw, 0, 5);        // front brake cable
  linePts(-0.4, 0.62, -1.3, 0.4, 14, raw, 0, 5);       // rear brake cable
  return bikeFit(raw);
}

// rocket booster strapped to the frame
function bikeRocketRaw() {
  const raw = bikeRaw();
  const ry = 1.15;
  linePts(-1.1, ry - 0.2, 0.72, ry - 0.2, 42, raw);    // body
  linePts(-1.1, ry + 0.2, 0.72, ry + 0.2, 42, raw);
  linePts(-1.1, ry - 0.2, -1.1, ry + 0.2, 12, raw);    // tail cap
  linePts(0.72, ry + 0.2, 1.14, ry, 16, raw);          // nose cone
  linePts(0.72, ry - 0.2, 1.14, ry, 16, raw);
  linePts(-1.1, ry + 0.2, -1.34, ry + 0.44, 10, raw);  // fins
  linePts(-1.1, ry - 0.2, -1.34, ry - 0.44, 10, raw);
  linePts(-1.34, ry + 0.44, -1.0, ry + 0.2, 9, raw);
  linePts(-1.34, ry - 0.44, -1.0, ry - 0.2, 9, raw);
  linePts(-0.45, ry - 0.2, -0.45, ry + 0.2, 10, raw);  // hull rings
  linePts(0.15, ry - 0.2, 0.15, ry + 0.2, 10, raw);
  linePts(-0.38, ry - 0.2, -0.4, 0.66, 12, raw);       // mounting struts
  linePts(0.55, ry - 0.2, 0.9, 0.62, 12, raw);
  for (let i = 0; i < 360; i++) {                      // exhaust flame
    const t = Math.pow(Math.random(), 0.8);
    const spread = 0.05 + t * 0.28;
    raw.push([-1.36 - t * 1.0 + gauss() * 0.06, ry + gauss() * spread, gauss() * spread]);
  }
  return raw;
}

// 1902 — a bicycle with a small engine strapped inside the frame
function bikeMotorRaw() {
  const raw = bikeRaw();
  const ex = -0.05, ey = -0.12, hw = 0.31, hh = 0.25;  // engine block
  linePts(ex - hw, ey - hh, ex + hw, ey - hh, 16, raw);
  linePts(ex - hw, ey + hh, ex + hw, ey + hh, 16, raw);
  linePts(ex - hw, ey - hh, ex - hw, ey + hh, 12, raw);
  linePts(ex + hw, ey - hh, ex + hw, ey + hh, 12, raw);
  for (let i = 1; i <= 3; i++) {                       // cooling fins
    const fy = ey - hh + (i * hh * 2) / 4;
    linePts(ex - hw + 0.05, fy, ex + hw - 0.05, fy, 12, raw);
  }
  linePts(ex - 0.1, ey + hh, ex - 0.1, ey + hh + 0.17, 8, raw);  // cylinder head
  linePts(ex + 0.1, ey + hh, ex + 0.1, ey + hh + 0.17, 8, raw);
  linePts(ex - 0.15, ey + hh + 0.17, ex + 0.15, ey + hh + 0.17, 9, raw);
  linePts(ex - hw, ey - 0.05, -1.32, -0.48, 26, raw);  // belt drive to rear hub
  linePts(ex - hw, ey - 0.2, -1.32, -0.62, 26, raw);
  linePts(ex + hw, ey - 0.2, 0.8, -0.78, 14, raw);     // exhaust pipe
  linePts(0.8, -0.78, 1.34, -0.84, 12, raw);
  for (let i = 0; i < 60; i++) {                       // puff of exhaust smoke
    const t = Math.random();
    raw.push([1.4 + t * 0.5 + gauss() * 0.1, -0.84 + t * 0.12 + gauss() * (0.05 + t * 0.12), gauss() * 0.1]);
  }
  return raw;
}

// the reveal — both heresies at once, stacked
function bikeDuo() {
  const raw = [];
  for (const p of bikeRocketRaw()) raw.push([p[0] * 0.72, p[1] * 0.72 + 1.12, p[2]]);
  for (const p of bikeMotorRaw()) raw.push([p[0] * 0.72, p[1] * 0.72 - 1.14, p[2]]);
  return fitPoints(raw.map(p => [p[0] * 1.35, p[1] * 1.35, p[2]]), 0.025);
}

// --- chaos cloud vs ordered lattice (Big Idea 1) ---
function splitClusters() {
  const raw = [];
  for (let i = 0; i < 2600; i++) raw.push([-2.0 + gauss() * 1.0, gauss() * 1.0, gauss() * 1.0]);
  const n = 9, sp = 0.27, off = ((n - 1) * sp) / 2;
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++)
        raw.push([2.0 + x * sp - off, y * sp - off, z * sp - off]);
  return fitPoints(raw, 0.015);
}

// --- flowing wave plane (Big Idea 2) ---
function wave() {
  const raw = [];
  const rot = -0.95, cr = Math.cos(rot), sr = Math.sin(rot);
  for (let ix = 0; ix < 130; ix++) {
    for (let iz = 0; iz < 56; iz++) {
      const x = -3.6 + (ix / 129) * 7.2;
      const z = -2.1 + (iz / 55) * 4.2;
      const y = Math.sin(x * 1.5) * Math.cos(z * 1.6) * 0.42;
      raw.push([x, y * cr - z * sr, y * sr + z * cr]);
    }
  }
  return fitPoints(raw, 0.015);
}

// --- five rings with stage symbols inside (process) ---
// eye · question mark · lightbulb · cube · checkmark — hover groups 1-5
function stagesRings() {
  const cw = 2600, ch = 560;
  const cnv = document.createElement('canvas');
  cnv.width = cw; cnv.height = ch;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const xs = [260, 780, 1300, 1820, 2340], y = 280;

  xs.forEach((x, i) => {
    ctx.beginPath(); ctx.arc(x, y, 150, 0, 7); ctx.stroke();
    if (i < 4) { ctx.beginPath(); ctx.moveTo(x + 172, y); ctx.lineTo(x + 340, y); ctx.stroke(); }
  });

  // 1 — eye (observe)
  let x = xs[0];
  ctx.beginPath(); ctx.ellipse(x, y, 82, 46, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();

  // 2 — question mark (interpret)
  ctx.font = '500 170px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', xs[1], y + 8);

  // 3 — lightbulb (imagine)
  x = xs[2];
  ctx.beginPath(); ctx.arc(x, y - 14, 52, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.rect(x - 20, y + 44, 40, 16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 15, y + 6); ctx.lineTo(x, y - 10); ctx.lineTo(x + 15, y + 6); ctx.stroke();
  for (const a of [-2.4, -1.57, -0.74]) {              // rays
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 66, y - 14 + Math.sin(a) * 66);
    ctx.lineTo(x + Math.cos(a) * 92, y - 14 + Math.sin(a) * 92);
    ctx.stroke();
  }

  // 4 — cube (prototype)
  x = xs[3];
  ctx.beginPath(); ctx.rect(x - 58, y - 22, 82, 82); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 58, y - 22); ctx.lineTo(x - 24, y - 56); ctx.lineTo(x + 58, y - 56); ctx.lineTo(x + 24, y - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 58, y - 56); ctx.lineTo(x + 58, y + 26); ctx.lineTo(x + 24, y + 60); ctx.stroke();

  // 5 — checkmark (validate)
  x = xs[4];
  ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(x - 58, y + 2); ctx.lineTo(x - 14, y + 48); ctx.lineTo(x + 62, y - 44); ctx.stroke();

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const raw = [];
  const s = 7.5 / cw;
  for (let py = 0; py < ch; py += 2) {
    for (let px = 0; px < cw; px += 2) {
      if (data[(py * cw + px) * 4 + 3] > 60) {
        raw.push([
          (px - cw / 2) * s,
          -(py - ch / 2) * s,
          (Math.random() - 0.5) * 0.12,
          1 + Math.min(4, Math.floor(px / 520)),      // hover group per ring
        ]);
      }
    }
  }
  return fitPoints(raw, 0.008);
}

// --- circular equalizer burst (Discover Weekly) ---
function soundburst() {
  const raw = [];
  circlePts(0, 0, 0.52, 200, raw);
  circlePts(0, 0, 0.6, 140, raw);
  const NB = 60;
  for (let i = 0; i < NB; i++) {
    const a = (i / NB) * Math.PI * 2;
    const len = 0.45 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 1.15 + Math.random() * 0.25;
    const n = Math.max(6, Math.floor(len * 26));
    for (let j = 0; j < n; j++) {
      const rr = 0.82 + (j / (n - 1)) * len;
      raw.push([Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - 0.5) * 0.12]);
    }
  }
  circlePts(0, 0, 2.5, 320, raw);
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * 0.16;
    raw.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]);
  }
  return fitPoints(raw, 0.03);
}

// --- lightsaber beam between Research and Vision (hover group 6) ---
// Positioned at runtime to sit exactly on the DOM hairline. Kept as a very
// tight core so at rest it reads as one crisp hairline of light; the hover
// welding/scan effect lives in the shader.
function spectrum() {
  const raw = [];
  linePts(-3.1, 0, 3.1, 0, 3200, raw, 0, 6);           // dense hot core
  for (let i = 0; i < 700; i++) {                      // whisper-thin sheath
    raw.push([-3.1 + Math.random() * 6.2, gauss() * 0.014, gauss() * 0.014, 6]);
  }
  for (const ex of [-3.15, 3.15]) {                    // emitter caps
    for (let i = 0; i < 130; i++) raw.push([ex + gauss() * 0.05, gauss() * 0.05, gauss() * 0.05, 6]);
  }
  return fitPoints(raw, 0.005);
}

// --- 1908 Ford Model T (the quote slide) ---
function modelTRaw() {
  const raw = [];
  for (const wx of [-1.15, 1.15]) {                    // spoked wheels
    circlePts(wx, -0.72, 0.5, 130, raw);
    circlePts(wx, -0.72, 0.44, 60, raw);
    circlePts(wx, -0.72, 0.09, 20, raw);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      linePts(wx, -0.72, wx + Math.cos(a) * 0.44, -0.72 + Math.sin(a) * 0.44, 9, raw);
    }
    arcPts(wx, -0.72, 0.64, Math.PI * 0.12, Math.PI * 0.88, 40, raw); // fender
  }
  linePts(-0.5, -0.58, 0.55, -0.58, 20, raw);          // running board
  // hood + radiator
  linePts(0.62, -0.05, 1.45, -0.16, 22, raw);
  linePts(1.45, -0.16, 1.47, -0.62, 14, raw);
  linePts(0.62, -0.48, 1.45, -0.62, 20, raw);
  linePts(0.62, -0.48, 0.62, -0.05, 12, raw);
  for (const lx of [0.85, 1.0, 1.15]) linePts(lx, -0.4, lx, -0.24, 6, raw); // louvres
  circlePts(1.56, -0.18, 0.09, 22, raw);               // headlamp
  // tall cabin
  linePts(0.62, -0.05, 0.55, 0.78, 18, raw);           // front pillar
  linePts(0.55, 0.78, -1.0, 0.82, 30, raw);            // roof
  linePts(-1.0, 0.82, -1.05, -0.5, 24, raw);           // back
  linePts(-1.05, -0.5, 0.62, -0.48, 30, raw);          // sill
  linePts(-1.0, 0.1, 0.58, 0.14, 26, raw);             // belt line
  linePts(-0.22, -0.48, -0.2, 0.1, 12, raw);           // door
  linePts(0.5, 0.12, 0.46, 0.72, 12, raw);             // windshield
  circlePts(0.12, 0.22, 0.12, 22, raw);                // steering wheel
  linePts(0.12, 0.22, 0.34, -0.05, 8, raw);            // column
  return raw;
}

function fordScene() {
  const pts = [];
  const q = sampleGlyph('“', { targetH: 2.4, weight: '700' });
  if (q) for (const p of q) pts.push([p[0] - 2.7, p[1] + 1.55, p[2]]);
  for (const p of modelTRaw()) pts.push([p[0] * 0.95 + 2.55, p[1] * 0.95 - 1.5, p[2]]);
  return fitPoints(pts, 0.015);
}

// --- knight on a receding chessboard (intuition, grand version) ---
function knightGrand() {
  const glyph =
    sampleGlyph('♞', { targetH: 4.3, weight: '400', family: '"Apple Symbols", "Segoe UI Symbol", serif' }) ||
    sampleGlyph('?', { targetH: 4.2 });
  const pts = glyph.map(p => [p[0], p[1] + 0.75, p[2]]);
  // checkerboard floor, tilted away from camera
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2) continue;
      for (let i = 0; i < 90; i++) {
        const bx = (c - 3.5) * 0.62 + (Math.random() - 0.5) * 0.54;
        const bz = (r - 3.5) * 0.62 + (Math.random() - 0.5) * 0.54;
        pts.push([bx * (1 - bz * 0.045), -1.72 + bz * 0.4, -bz * 0.85]);
      }
    }
  }
  return fitPoints(pts, 0.02);
}

/* ------------------------------------------------------------
   Section metadata — shape + framing per slide
   ------------------------------------------------------------ */

let SHAPES = []; // built after fonts load

const META = [
  { off: [0, 0.1, 0],      sc: 1.12, colA: IVORY,     colB: '#8f7bff', op: 0.8  }, // 0 hero — sphere
  { off: [0, 0, -0.7],     sc: 1,    colA: IVORY,     colB: '#ffd9a0', op: 0.75 }, // 1 quote — “ + Model T
  { off: [2.6, 0, -0.5],   sc: 1,    colA: IVORY,     colB: '#7cc4ff', op: 0.9  }, // 2 question — ?
  { off: [0, 1.85, -0.2],  sc: 0.98, colA: IVORY,     colB: '#ffc46b', op: 1    }, // 3 timeline — icons
  { off: [0, -0.1, -1],    sc: 1,    colA: ACCENT,    colB: '#ffc46b', op: 0.6  }, // 4 idea 1 — split
  { off: [0, 0.1, -0.6],   sc: 1.05, colA: IVORY,     colB: '#7cc4ff', op: 0.75 }, // 5 ≠
  { off: [2.1, -0.15, 0],  sc: 1,    colA: IVORY,     colB: '#9adcff', op: 1    }, // 6 bicycle — the question
  { off: [-2.9, -0.15, 0], sc: 0.92, colA: IVORY,     colB: '#9adcff', op: 1    }, // 7 bicycle — tuned
  { off: [2.6, 0, 0],      sc: 0.95, colA: IVORY,     colB: ACCENT,    op: 1    }, // 8 bicycle — rocket + 1902 motor
  { off: [0, -1.2, -1],    sc: 1.05, colA: ACCENT,    colB: '#ff9d5c', op: 0.75 }, // 9 idea 2 — wave
  { off: [0, 1.05, 0],     sc: 0.9,  colA: IVORY,     colB: ACCENT,    op: 0.85 }, // 10 process — rings
  { off: [2.5, 0.1, 0],    sc: 1.22, colA: IVORY,     colB: '#b7a8ff', op: 1    }, // 11 intuition — knight + board
  { off: [3.0, 0, -1.6],   sc: 0.9,  colA: '#1ed760', colB: '#4ef0c0', op: 0.85 }, // 12 discover — soundburst
  { off: [0, 0, -1.4],     sc: 1.15, colA: IVORY,     colB: ACCENT,    op: 0.5  }, // 13 danger — ×
  { off: [0, -1.15, -0.6], sc: 0.8,  colA: ACCENT,    colB: '#ffc46b', op: 0.85 }, // 14 idea 3 — →
  { off: [0, -2.05, -0.5], sc: 1,    colA: IVORY,     colB: '#7cc4ff', op: 0.95 }, // 15 balance — spectrum
  { off: [0, 0, -0.5],     sc: 1.25, colA: IVORY,     colB: '#ffb36b', op: 0.9  }, // 16 final — galaxy
];

/* ------------------------------------------------------------
   Three.js setup
   ------------------------------------------------------------ */

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.z = 9;

const group = new THREE.Group();
scene.add(group);

// CPU-side arrays (needed to capture mid-morph states)
const randArr = new Float32Array(COUNT);
const noiseArr = new Float32Array(COUNT * 3);
const sizeArr = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  randArr[i] = Math.random();
  sizeArr[i] = 0.6 + Math.random() * 1.0;
  const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
  const m = Math.random() * 1.1;
  noiseArr[i * 3] = Math.sin(b) * Math.cos(a) * m;
  noiseArr[i * 3 + 1] = Math.sin(b) * Math.sin(a) * m;
  noiseArr[i * 3 + 2] = Math.cos(b) * m;
}

const geometry = new THREE.BufferGeometry();
const srcAttr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
const tgtAttr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
const grpAttr = new THREE.BufferAttribute(new Float32Array(COUNT), 1);
geometry.setAttribute('position', srcAttr);
geometry.setAttribute('aTarget', tgtAttr);
geometry.setAttribute('aGroup', grpAttr);
geometry.setAttribute('aRand', new THREE.BufferAttribute(randArr, 1));
geometry.setAttribute('aNoiseDir', new THREE.BufferAttribute(noiseArr, 3));
geometry.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1));

const uniforms = {
  uProgress: { value: 1 },
  uTime: { value: 0 },
  uBurst: { value: 1.1 },
  uColorA: { value: new THREE.Color(IVORY) },
  uColorB: { value: new THREE.Color('#8f7bff') },
  uOpacity: { value: 0 },
  uHeight: { value: renderer.domElement.height },
  uHiGroup: { value: -1 },
  uHiMix: { value: 0 },
  uMx: { value: 999 },
  uIgnite: { value: 0 }, // left-to-right laser ignition sweep (balance slide)
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute vec3 aTarget;
    attribute vec3 aNoiseDir;
    attribute float aRand;
    attribute float aSize;
    attribute float aGroup;
    uniform float uProgress, uTime, uBurst, uHeight, uHiGroup, uHiMix, uMx, uIgnite;
    uniform vec3 uColorA, uColorB;
    varying float vAlpha;
    varying vec3 vColor;
    varying float vHi, vDim;
    const float PI = 3.14159265;
    const float STAG = ${STAG};

    void main() {
      float t = clamp(uProgress * (1.0 + STAG) - aRand * STAG, 0.0, 1.0);
      t = t * t * (3.0 - 2.0 * t);
      vec3 pos = mix(position, aTarget, t);

      float isBeam = step(5.5, aGroup); // group 6 (the laser) => 1

      float burst = sin(t * PI);
      pos += aNoiseDir * burst * uBurst;
      // tangential swirl while in flight — particles corkscrew between shapes
      vec3 tang = cross(aNoiseDir, vec3(0.0, 0.0, 1.0));
      pos += tang * burst * uBurst * 0.65 * (aRand - 0.5) * 2.0;

      // breathing idle drift — always alive, but the laser barely moves so it stays crisp
      pos += 0.07 * (1.0 - isBeam * 0.94) * vec3(
        sin(pos.y * 1.7 + uTime * 0.6 + aRand * 6.28),
        sin(pos.z * 1.9 + uTime * 0.5 + aRand * 6.28),
        sin(pos.x * 1.5 + uTime * 0.7)
      );

      float match = step(abs(aGroup - uHiGroup), 0.45);
      float h = uHiMix * match;

      // --- generic hover (icons, bike parts, stages): steady ignite + travelling
      // shimmer + a bright spot that follows the cursor across the shape ---
      float shimmer = 0.5 + 0.5 * sin(pos.x * 5.0 - uTime * 12.0);
      float proxG = exp(-abs(pos.x - uMx) * 1.7);
      float genHi = 0.7 + 0.9 * shimmer + 1.8 * proxG;

      // --- laser hover (group 6): crisp beam, L->R ignition, travelling scan, welding sparks ---
      float nx = (pos.x + 3.1) / 6.2;                        // 0..1 along the beam
      float lit = smoothstep(uIgnite + 0.06, uIgnite - 0.16, nx); // fills left-to-right
      float scanX = -3.1 + 6.2 * fract(uTime * 0.32);        // scanning band of light
      float scan = exp(-abs(pos.x - scanX) * 2.4);
      float weld = exp(-abs(pos.x - uMx) * 5.5);             // tight welding hotspot at the cursor
      float beamHi = lit * (0.35 + 0.7 * scan) + 2.4 * weld;

      vHi = h * mix(genHi, beamHi, isBeam);
      vDim = uHiMix * (1.0 - match);

      // welding sparks — only the laser, only right at the cursor: scatter a few points out
      float spark = weld * h * isBeam;
      pos += aNoiseDir * spark * 0.20 * (0.5 + 0.9 * sin(uTime * 36.0 + aRand * 44.0));
      pos.y += vHi * 0.03 * sin(uTime * 9.0 + aRand * 6.28) * (1.0 - isBeam);

      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      float pulse = 1.0 + 0.22 * sin(uTime * 1.25 + aRand * 6.28);
      gl_PointSize = aSize * uHeight * 0.0025 * (9.0 / max(1.0, -mv.z)) * pulse * (1.0 + vHi * 0.9);
      vAlpha = 0.5 + 0.5 * sin(aRand * 6.28 + uTime * 0.9);
      vColor = mix(uColorA, uColorB, smoothstep(0.15, 0.85, fract(aRand * 3.7)));
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uOpacity;
    varying float vAlpha;
    varying vec3 vColor;
    varying float vHi, vDim;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float core = smoothstep(0.24, 0.05, d);
      float halo = smoothstep(0.5, 0.2, d) * 0.45;
      vec3 col = mix(vColor, vec3(1.0, 0.98, 0.9), min(vHi, 1.0) * 0.8);
      float a = min(core + halo, 1.0) * vAlpha * uOpacity;
      a *= (1.0 + vHi * 1.5) * (1.0 - vDim * 0.55);
      if (a < 0.003) discard;
      gl_FragColor = vec4(col, min(a, 1.0));
    }
  `,
});

const points = new THREE.Points(geometry, material);
points.frustumCulled = false;
group.add(points);

/* ------------------------------------------------------------
   Morph engine
   ------------------------------------------------------------ */

const state = { progress: 1, current: -1 };
let progressTween = null;

function captureCurrent() {
  // bake current interpolated positions (incl. burst) into position attr
  const src = srcAttr.array, tgt = tgtAttr.array;
  const P = state.progress, B = uniforms.uBurst.value;
  for (let i = 0; i < COUNT; i++) {
    let t = Math.min(1, Math.max(0, P * (1 + STAG) - randArr[i] * STAG));
    t = t * t * (3 - 2 * t);
    const b = Math.sin(t * Math.PI) * B;
    for (let k = 0; k < 3; k++) {
      const j = i * 3 + k;
      src[j] = src[j] + (tgt[j] - src[j]) * t + noiseArr[j] * b;
    }
  }
  srcAttr.needsUpdate = true;
}

function morphTo(idx, instant = false) {
  const shape = SHAPES[idx];
  if (!shape) return;
  if (progressTween) progressTween.kill();

  captureCurrent();
  tgtAttr.array.set(shape);
  tgtAttr.needsUpdate = true;
  if (shape.groups) grpAttr.array.set(shape.groups);
  else grpAttr.array.fill(0);
  grpAttr.needsUpdate = true;
  gsap.to(uniforms.uHiMix, { value: 0, duration: 0.3, overwrite: 'auto' });
  gsap.to(uniforms.uIgnite, { value: 0, duration: 0.3, overwrite: 'auto' });
  state.progress = 0;
  uniforms.uProgress.value = 0;

  if (instant) {
    state.progress = 1;
    uniforms.uProgress.value = 1;
    return;
  }
  progressTween = gsap.to(state, {
    progress: 1,
    duration: 1.6,
    ease: 'expo.inOut',
    onUpdate: () => (uniforms.uProgress.value = state.progress),
  });
}

const HALFH = Math.tan((25 * Math.PI) / 180) * 9; // world half-height at z=0
const BALANCE_IDX = 15;

// world-space position/scale that puts the particle beam exactly on the DOM hairline
function alignSpectrum() {
  const line = document.querySelector('.spec-line');
  if (!line || !line.offsetWidth) return null;
  let top = 0, left = 0, n = line;
  while (n) { top += n.offsetTop; left += n.offsetLeft; n = n.offsetParent; }
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = HALFH * (vw / vh);
  const secTop = offsets[BALANCE_IDX] || 0;
  const cx = (((left + line.offsetWidth / 2) / vw) - 0.5) * 2 * W;
  const cy = (0.5 - (top - secTop) / vh) * 2 * HALFH;
  const sx = ((line.offsetWidth / vw) * 2 * W) / 6.2; // beam spans ±3.1
  return { cx, cy, sx };
}

function applySection(idx, instant = false) {
  if (idx === state.current) return;
  state.current = idx;
  const m = META[idx];
  const mobileScale = IS_MOBILE ? 0.62 : 1;

  morphTo(idx, instant);
  const d = instant ? 0 : 1.6;
  const a = idx === BALANCE_IDX ? alignSpectrum() : null;
  if (a) {
    gsap.to(group.position, { x: a.cx, y: a.cy, z: 0, duration: d, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(group.scale, { x: a.sx, y: a.sx, z: a.sx, duration: d, ease: 'power3.inOut', overwrite: 'auto' });
  } else {
  gsap.to(group.position, { x: m.off[0] * mobileScale, y: m.off[1], z: m.off[2], duration: d, ease: 'power3.inOut', overwrite: 'auto' });
  gsap.to(group.scale, { x: m.sc * mobileScale, y: m.sc * mobileScale, z: m.sc * mobileScale, duration: d, ease: 'power3.inOut', overwrite: 'auto' });
  }
  gsap.to(uniforms.uColorA.value, { ...new THREE.Color(m.colA), duration: d * 0.8, ease: 'power2.inOut', overwrite: 'auto' });
  gsap.to(uniforms.uColorB.value, { ...new THREE.Color(m.colB), duration: d * 0.8, ease: 'power2.inOut', overwrite: 'auto' });
  gsap.to(uniforms.uOpacity, { value: m.op, duration: d * 0.8, ease: 'power2.inOut', overwrite: 'auto' });

  if (!instant) {
    // camera punch-in + randomized burst energy per morph
    uniforms.uBurst.value = 1.0 + Math.random() * 0.6;
    gsap.fromTo(camera.position, { z: 9.6 }, { z: 9, duration: 1.7, ease: 'expo.out', overwrite: 'auto' });
    gsap.fromTo(points.rotation, { z: (Math.random() - 0.5) * 0.16 }, { z: 0, duration: 1.8, ease: 'expo.out', overwrite: 'auto' });
  }

  // UI
  document.getElementById('counterNow').textContent = String(idx + 1).padStart(2, '0');
  dotsEls.forEach((b, i) => b.classList.toggle('active', i === idx));
  document.getElementById('scrollHint').style.opacity = idx === META.length - 1 ? '0' : '1';
}

/* ------------------------------------------------------------
   Mouse parallax + render loop
   ------------------------------------------------------------ */

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', e => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5);
  mouse.ty = (e.clientY / window.innerHeight - 0.5);
});

const clock = new THREE.Clock();
function render() {
  const t = clock.getElapsedTime();
  uniforms.uTime.value = t;
  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;

  // the saber slide needs a perfectly steady beam; everything else breathes freely
  const steady = state.current === BALANCE_IDX ? 0.12 : 1;

  // breathing — the whole formation slowly inhales/exhales while you speak
  const breathe = 1 + 0.04 * steady * Math.sin(t * 0.65);
  points.scale.setScalar(breathe);

  group.rotation.y = (mouse.x * 0.3 + Math.sin(t * 0.07) * 0.1) * steady;
  group.rotation.x = (mouse.y * 0.2 + Math.cos(t * 0.09) * 0.045) * steady;

  // scroll parallax — shape drifts as you move through a section
  if (state.current >= 0 && offsets.length) {
    const local = (lenis.scroll - offsets[state.current]) / window.innerHeight;
    points.position.y = -local * 0.55 * steady;
  }

  // cursor x in the particle group's local space (drives the saber proximity glow)
  const W = HALFH * (window.innerWidth / window.innerHeight);
  uniforms.uMx.value = (mouse.tx * 2 * W - group.position.x) / (group.scale.x || 1);

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------
   Scroll — Lenis + soft snap + section detection
   ------------------------------------------------------------ */

const sections = Array.from(document.querySelectorAll('.panel'));
let offsets = [];
function measure() {
  offsets = sections.map(s => s.offsetTop);
}

const lenis = new Lenis({ duration: 1.25, smoothWheel: true, touchMultiplier: 1.25 });
window.__lenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => {
  lenis.raf(time * 1000);
  render();
});
gsap.ticker.lagSmoothing(0);

function nearestIndex(scroll) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < offsets.length; i++) {
    const d = Math.abs(offsets[i] - scroll);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

lenis.on('scroll', ({ scroll }) => {
  const idx = nearestIndex(scroll + window.innerHeight * 0.45);
  if (idx !== state.current && state.current !== -1) applySection(idx);
});

// Smooth ease-in-out with a soft, spring-like settle. Kept strictly within [0,1]
// on purpose: a real overshoot spring goes past the scroll bounds (below 0 at the
// top, past the limit at the end) and Lenis clamps there, which freezes the tween.
// This quint-out tail gives an elastic, gently-decelerating feel without that risk.
function springEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5
    ? 4 * t * t * t                         // cubic ease-in
    : 1 - Math.pow(-2 * t + 2, 4.6) / 2;    // soft quint-ish ease-out (springy settle)
}

let lastInteract = 0, snapLock = false, snapping = false;
function snapTo(target, duration = 1.0) {
  snapLock = true; snapping = true;
  lenis.scrollTo(target, {
    duration,
    easing: springEase,
    onComplete: () => { snapLock = false; snapping = false; },
  });
}
// any fresh user input cancels an in-flight snap so we never fight the scroll
function onUserScroll() {
  lastInteract = performance.now();
  if (snapping) { snapping = false; snapLock = false; }
}
['wheel', 'touchstart', 'touchmove', 'pointerdown'].forEach(ev =>
  window.addEventListener(ev, onUserScroll, { passive: true })
);

// snap to the NEAREST section only once the scroll has genuinely settled — no forward bias,
// so a small scroll never yanks you to the next frame
gsap.ticker.add(() => {
  if (snapLock) return;
  if (lenis.isScrolling === 'smooth') return; // a programmatic scroll is already running
  if (performance.now() - lastInteract < 170) return;
  if (Math.abs(lenis.velocity) > 0.055) return;
  const idx = nearestIndex(lenis.scroll);
  const target = offsets[idx];
  if (Math.abs(target - lenis.scroll) < 6) return;
  snapTo(target);
});

// keyboard navigation
window.addEventListener('keydown', e => {
  const idx = state.current === -1 ? 0 : state.current;
  let next = null;
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') next = Math.min(idx + 1, sections.length - 1);
  if (e.key === 'ArrowUp' || e.key === 'PageUp') next = Math.max(idx - 1, 0);
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = sections.length - 1;
  if (next !== null) {
    e.preventDefault();
    snapTo(offsets[next], 1.1);
  }
});

// dots nav
const dotsWrap = document.getElementById('dots');
const dotsEls = sections.map((_, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', `Slide ${i + 1}`);
  b.addEventListener('click', () => snapTo(offsets[i], 1.2));
  dotsWrap.appendChild(b);
  return b;
});

/* ------------------------------------------------------------
   Hover highlights — DOM elements ignite their particle group
   ------------------------------------------------------------ */

document.querySelectorAll('[data-hi]').forEach(el => {
  const g = +el.dataset.hi;
  el.addEventListener('mouseenter', () => {
    uniforms.uHiGroup.value = g;
    gsap.to(uniforms.uHiMix, { value: 1, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
    if (g === 6) gsap.to(uniforms.uIgnite, { value: 1, duration: 0.75, ease: 'power2.out', overwrite: 'auto' });
  });
  el.addEventListener('mouseleave', () => {
    gsap.to(uniforms.uHiMix, { value: 0, duration: 0.7, ease: 'power2.out', overwrite: 'auto' });
    if (g === 6) gsap.to(uniforms.uIgnite, { value: 0, duration: 0.5, ease: 'power2.in', overwrite: 'auto' });
  });
});

/* ------------------------------------------------------------
   Ghost slide numerals + custom cursor
   ------------------------------------------------------------ */

sections.forEach((sec, i) => {
  const g = document.createElement('span');
  g.className = 'ghost-num';
  g.textContent = String(i + 1).padStart(2, '0');
  g.setAttribute('aria-hidden', 'true');
  sec.appendChild(g);
});

const cursorEl = document.getElementById('cursor');
if (cursorEl && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  // Detect interactivity by sampling the element under the pointer every move.
  // This can never get "stuck" the way per-element enter/leave listeners do.
  const HOT = '[data-hi], .ui-dots button, .card, a, .spectrum, .timeline-row li, .answers li, .stage, .play-pill';
  let cx = -100, cy = -100, tx = -100, ty = -100, grown = false;
  window.addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    document.body.classList.add('has-cursor');
    const el = document.elementFromPoint(tx, ty);
    const hot = !!(el && el.closest(HOT));
    if (hot !== grown) { grown = hot; cursorEl.classList.toggle('grow', hot); }
  });
  window.addEventListener('pointerdown', () => cursorEl.classList.add('press'));
  window.addEventListener('pointerup', () => cursorEl.classList.remove('press'));
  document.addEventListener('mouseleave', () => document.body.classList.remove('has-cursor'));
  gsap.ticker.add(() => {
    cx += (tx - cx) * 0.3;
    cy += (ty - cy) * 0.3;
    cursorEl.style.transform = `translate(${cx}px, ${cy}px)`;
  });
}

/* ------------------------------------------------------------
   Idle chrome fade — after 1s without input, all UI chrome steps
   aside so the room sees only the graphic and the content
   ------------------------------------------------------------ */

let idleTimer = null;
function bumpIdle() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 1000);
}
['pointermove', 'wheel', 'touchstart', 'keydown'].forEach(ev =>
  window.addEventListener(ev, bumpIdle, { passive: true })
);
bumpIdle();

/* ------------------------------------------------------------
   Text reveals per section
   ------------------------------------------------------------ */

function setupReveals() {
  sections.forEach(sec => {
    const els = sec.querySelectorAll('.r');
    gsap.set(els, { y: 60, opacity: 0, filter: 'blur(12px)' });
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 62%',
      end: 'bottom 38%',
      toggleClass: { targets: sec, className: 'in' },
      onEnter: () => gsap.to(els, { y: 0, opacity: 1, filter: 'blur(0px)', stagger: 0.09, duration: 1.2, ease: 'power3.out', overwrite: 'auto' }),
      onEnterBack: () => gsap.to(els, { y: 0, opacity: 1, filter: 'blur(0px)', stagger: 0.06, duration: 0.9, ease: 'power3.out', overwrite: 'auto' }),
      onLeave: () => gsap.to(els, { y: -40, opacity: 0, filter: 'blur(8px)', duration: 0.5, ease: 'power2.in', overwrite: 'auto' }),
      onLeaveBack: () => gsap.to(els, { y: 60, opacity: 0, filter: 'blur(8px)', duration: 0.5, ease: 'power2.in', overwrite: 'auto' }),
    });
  });
}

/* ------------------------------------------------------------
   Resize
   ------------------------------------------------------------ */

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  uniforms.uHeight.value = renderer.domElement.height;
  measure();
  ScrollTrigger.refresh();
  if (state.current === BALANCE_IDX) {
    const a = alignSpectrum();
    if (a) {
      gsap.set(group.position, { x: a.cx, y: a.cy, z: 0 });
      gsap.set(group.scale, { x: a.sx, y: a.sx, z: a.sx });
    }
  }
});

/* ------------------------------------------------------------
   Boot — wait for fonts (glyph sampling needs them), build shapes
   ------------------------------------------------------------ */

const loaderBar = document.getElementById('loaderBar');
loaderBar.style.transform = 'scaleX(0.3)';

async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 200px "Space Grotesk"'),
        document.fonts.ready,
      ]),
      new Promise(res => setTimeout(res, 3500)),
    ]);
  } catch (_) { /* proceed anyway */ }

  loaderBar.style.transform = 'scaleX(0.65)';

  const fallbackQ = { text: '?', opts: { targetH: 4.2 } };
  SHAPES = [
    sphere(),                                                              // 0
    fordScene(),                                                           // 1 “ + Model T
    glyphShape('?', { targetH: 4.3, weight: '500' }),                      // 2
    icons(),                                                               // 3
    splitClusters(),                                                       // 4
    glyphShape('≠', { targetH: 3.6, weight: '500' }, fallbackQ),      // 5 ≠
    bicycle(),                                                             // 6
    bikeTuned(),                                                           // 7
    bikeDuo(),                                                             // 8
    wave(),                                                                // 9
    stagesRings(),                                                         // 10
    knightGrand(),                                                         // 11 ♞ + board
    soundburst(),                                                          // 12
    glyphShape('×', { targetH: 3.6, weight: '300' }, fallbackQ),      // 13 ×
    glyphShape('→', { targetH: 2.6, weight: '400' }, fallbackQ),      // 14 →
    spectrum(),                                                            // 15
    galaxy(),                                                              // 16
  ];

  // initialize on shape 0, fully settled
  srcAttr.array.set(SHAPES[0]);
  tgtAttr.array.set(SHAPES[0]);
  srcAttr.needsUpdate = true;
  tgtAttr.needsUpdate = true;

  measure();
  setupReveals();
  applySection(nearestIndex(lenis.scroll + window.innerHeight * 0.25), true);

  loaderBar.style.transform = 'scaleX(1)';

  // intro
  const loader = document.getElementById('loader');
  gsap.to(loader, {
    opacity: 0,
    duration: 0.9,
    delay: 0.55,
    ease: 'power2.inOut',
    onComplete: () => loader.remove(),
  });
  gsap.to(uniforms.uOpacity, { value: META[0].op, duration: 2.2, delay: 0.7, ease: 'power2.out' });
  gsap.from(group.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 2.4, delay: 0.55, ease: 'power3.out' });
}

boot();
