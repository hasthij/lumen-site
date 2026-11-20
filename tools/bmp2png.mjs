// Converts a 32-bit BGRA premultiplied BMP written by `lumen --*-snapshot` (with LUMEN_SNAP_ALPHA=1)
// to a cropped, transparent PNG. Usage: node bmp2png.mjs in.bmp out.png [pad]
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const [, , inp, out, padArg] = process.argv;
const pad = Number(padArg ?? 0);
const b = readFileSync(inp);
const w = b.readInt32LE(18), h = Math.abs(b.readInt32LE(22)), off = b.readUInt32LE(10);

let x0 = w, y0 = h, x1 = -1, y1 = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (b[off + (y * w + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
}
if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

const raw = Buffer.alloc((cw * 4 + 1) * ch);
for (let y = 0; y < ch; y++) {
  raw[y * (cw * 4 + 1)] = 0;
  for (let x = 0; x < cw; x++) {
    const s = off + ((y + y0) * w + (x + x0)) * 4, d = y * (cw * 4 + 1) + 1 + x * 4;
    const a = b[s + 3], k = a ? 255 / a : 0; // un-premultiply
    raw[d] = Math.min(255, Math.round(b[s + 2] * k));
    raw[d + 1] = Math.min(255, Math.round(b[s + 1] * k));
    raw[d + 2] = Math.min(255, Math.round(b[s] * k));
    raw[d + 3] = a;
  }
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const v of buf) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw, 0); ihdr.writeUInt32BE(ch, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(`${out}: ${cw}x${ch}`);
