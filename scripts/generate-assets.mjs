/**
 * Generates Melo's real icon / splash / monochrome assets as PNGs.
 *
 * No image libraries: we rasterize the "Two Bubbles" mark analytically with
 * 4x4 supersampling and write the PNG ourselves (zlib is built into Node).
 *
 * Geometry lives in MARK below and is mirrored in src/components/ui/MeloMark.tsx.
 * Keep the two in sync — mark.paths() prints the equivalent SVG `d` strings.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/* ------------------------------------------------------------------ geometry */

// Design box is 64x64. Bubble A is solid (top-left), bubble B is outlined
// (bottom-right), tails point in opposite directions (down-left / up-right).
export const MARK = {
  box: 64,
  stroke: 3.5,
  solid: {
    body: { x: 3, y: 9, w: 36, h: 26, r: 10 },
    tail: [
      [11, 32],
      [8, 45],
      [22, 32],
    ],
  },
  outline: {
    body: { x: 25, y: 29, w: 36, h: 26, r: 10 },
    tail: [
      [43, 32],
      [55, 19],
      [52, 32],
    ],
  },
};

/** Rounded-rect `d` string. */
export function roundRectPath({ x, y, w, h, r }) {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

/** The mark as plain JSX-ready path data (mirrored in MeloMark.tsx). */
export function markPaths() {
  const { solid, outline } = MARK;
  return {
    solid: `${roundRectPath(solid.body)} ${solid.tail
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ')} Z`,
    outlineBody: roundRectPath(outline.body),
    outlineTail: outline.tail.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '),
  };
}

/* ---------------------------------------------------------------- rasterizer */

const SS = 4; // supersamples per axis

function sdRoundRect(px, py, { x, y, w, h, r }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len = vx * vx + vy * vy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len));
  const dx = wx - t * vx;
  const dy = wy - t * vy;
  return Math.sqrt(dx * dx + dy * dy);
}

function inTriangle(px, py, [a, b, c]) {
  // Consistent-sign test across all three edges.
  const edge = (p, q) => (p[0] - q[0]) * (py - q[1]) - (p[1] - q[1]) * (px - q[0]);
  const d1 = edge(a, b);
  const d2 = edge(b, c);
  const d3 = edge(c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** Coverage of a solid (filled) version of the mark at design-space point. */
function sampleSolid(px, py) {
  if (sdRoundRect(px, py, MARK.solid.body) <= 0) return true;
  return inTriangle(px, py, MARK.solid.tail);
}

/** Coverage of a filled silhouette (both bubbles solid) at design-space point. */
function sampleSilhouette(px, py) {
  if (sampleSolid(px, py)) return true;
  if (sdRoundRect(px, py, MARK.outline.body) <= 0) return true;
  return inTriangle(px, py, MARK.outline.tail);
}

/** Coverage of the stroked (outlined) bubble at design-space point. */
function sampleOutline(px, py) {
  const half = MARK.stroke / 2;
  if (Math.abs(sdRoundRect(px, py, MARK.outline.body)) <= half) return true;
  const t = MARK.outline.tail;
  return sdSegment(px, py, t[0], t[1]) <= half || sdSegment(px, py, t[1], t[2]) <= half;
}

/**
 * Rasterize the mark.
 * @param {number} size        output pixel size
 * @param {number} boxFraction fraction of `size` occupied by the 64x64 design box
 * @param {[number,number,number]} rgb mark color
 * @param {[number,number,number]|null} bg background color, or null for transparent
 * @param {'mark'|'silhouette'} shape
 * @param {boolean} opaque     emit RGB (no alpha) when there is a background
 */
function render(size, boxFraction, rgb, bg, shape = 'mark', opaque = false) {
  const scale = (size * boxFraction) / MARK.box;
  const offset = (size - MARK.box * scale) / 2;
  const px = Buffer.alloc(size * size * 4);
  const toDesign = (x) => (x - offset) / scale;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const dx = toDesign(x + (sx + 0.5) / SS);
          const dy = toDesign(y + (sy + 0.5) / SS);
          const onMark =
            shape === 'silhouette'
              ? sampleSilhouette(dx, dy)
              : sampleSolid(dx, dy) || sampleOutline(dx, dy);
          if (onMark) cover += 1;
        }
      }
      cover /= SS * SS;

      let r;
      let g;
      let b;
      let a = 255;
      if (bg) {
        r = Math.round(bg[0] + (rgb[0] - bg[0]) * cover);
        g = Math.round(bg[1] + (rgb[1] - bg[1]) * cover);
        b = Math.round(bg[2] + (rgb[2] - bg[2]) * cover);
      } else {
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];
        a = Math.round(255 * cover);
      }
      const i = (y * size + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
  return encodePng(size, size, px, opaque && bg ? 3 : 4);
}

/* ---------------------------------------------------------------- PNG writer */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba, channels) {
  const stride = w * channels;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const src = y * w * 4;
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < w; x += 1) {
      const s = src + x * 4;
      const d = y * (stride + 1) + 1 + x * channels;
      raw[d] = rgba[s];
      raw[d + 1] = rgba[s + 1];
      raw[d + 2] = rgba[s + 2];
      if (channels === 4) raw[d + 3] = rgba[s + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 4 ? 6 : 2; // RGBA : RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------------- main */

const EMBER = [0xff, 0x6a, 0x4d];
const EMBER_DARK = [0xff, 0x7d, 0x63];
const WHITE = [0xff, 0xff, 0xff];
const LIGHT_BG = [0xfa, 0xf9, 0xf7];

mkdirSync(OUT, { recursive: true });

const outputs = [
  // App icon: Ember mark on light background, 20% padding.
  ['icon.png', () => render(1024, 0.8, EMBER, LIGHT_BG, 'mark', true)],
  // Android adaptive foreground: 48% box keeps the mark inside the 66% safe zone.
  ['adaptive-icon.png', () => render(1024, 0.48, WHITE, null, 'mark')],
  ['adaptive-icon-monochrome.png', () => render(1024, 0.48, WHITE, null, 'silhouette')],
  // Splash: mark centered on the app background, light and dark variants.
  ['splash-icon.png', () => render(512, 0.84, EMBER, null, 'mark')],
  ['splash-icon-dark.png', () => render(512, 0.84, EMBER_DARK, null, 'mark')],
  ['favicon.png', () => render(64, 0.86, EMBER, LIGHT_BG, 'mark', true)],
];

for (const [name, fn] of outputs) {
  const buf = fn();
  writeFileSync(resolve(OUT, name), buf);
  console.log(`${name.padEnd(32)} ${(buf.length / 1024).toFixed(1)} KB`);
}

// ASCII proof of the rasterized mark, so the geometry can be eyeballed in a terminal.
console.log('\n--- raster preview (# = solid bubble, o = outlined bubble) ---');
for (let row = 0; row < 34; row += 1) {
  let line = '';
  for (let col = 0; col < 34; col += 1) {
    const x = ((col + 0.5) / 34) * MARK.box;
    const y = ((row + 0.5) / 34) * MARK.box;
    line += sampleSolid(x, y) ? '#' : sampleOutline(x, y) ? 'o' : '.';
  }
  console.log(line);
}

const p = markPaths();
console.log('\n--- SVG path data (mirror in MeloMark.tsx) ---');
console.log('solid  :', p.solid);
console.log('outBody:', p.outlineBody);
console.log('outTail:', p.outlineTail);
