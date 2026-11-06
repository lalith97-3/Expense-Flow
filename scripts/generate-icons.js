import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // PNG scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  let scanlineIdx = 0;
  for (let y = 0; y < height; y++) {
    scanlines[scanlineIdx++] = 0; // Filter byte: None
    const rowStart = y * width * 4;
    buffer.copy(scanlines, scanlineIdx, rowStart, rowStart + width * 4);
    scanlineIdx += width * 4;
  }

  const compressed = zlib.deflateSync(scanlines);

  // Helper for CRC32
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const chunk = Buffer.alloc(4 + 4 + data.length + 4);
    chunk.writeUInt32BE(data.length, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    chunk.writeUInt32BE(crc32(crcBuf), 8 + data.length);
    return chunk;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Icon generator logic
// Brand colors:
// Background: #0B111E (11, 17, 30)
// Emerald / Mint: #10B981 (16, 185, 129) and #34D399 (52, 211, 153)
function drawIcon(x, y, w, h, isMaskable = false) {
  // Center
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.hypot(x - cx, y - cy);

  // Background
  const bgR = 11, bgG = 17, bgB = 30; // #0B111E

  const safeRadius = isMaskable ? w * 0.38 : w * 0.44;

  // Let's draw rounded card or glowing badge
  const cornerRadius = w * 0.22;
  const inBox = Math.abs(x - cx) <= (w * 0.44) && Math.abs(y - cy) <= (h * 0.44);

  // Gradient background
  const ny = y / h;
  const rBg = Math.round(10 + ny * 6);
  const gBg = Math.round(17 + ny * 10);
  const bBg = Math.round(30 + ny * 15);

  // Outer ring / glow
  const glowDist = Math.abs(r - safeRadius * 0.85);
  let glow = 0;
  if (glowDist < w * 0.08) {
    glow = Math.max(0, 1 - glowDist / (w * 0.08));
  }

  // Draw Rupee '₹' and Flow Wave
  // Normalize coords to [-1, 1] relative to center within safe zone
  const scale = safeRadius * 0.75;
  const nx = (x - cx) / scale;
  const nyRel = (y - cy) / scale;

  let isSymbol = false;

  // Horizontal top bar 1
  if (nyRel >= -0.7 && nyRel <= -0.52 && nx >= -0.55 && nx <= 0.55) isSymbol = true;
  // Horizontal bar 2
  if (nyRel >= -0.4 && nyRel <= -0.22 && nx >= -0.55 && nx <= 0.45) isSymbol = true;

  // Vertical spine
  if (nx >= -0.45 && nx <= -0.25 && nyRel >= -0.7 && nyRel <= 0.7) isSymbol = true;

  // Top curve: from (-0.25, -0.7) to (0.25, -0.05) to (-0.25, -0.05)
  const curveDist = Math.hypot(nx - (-0.1), nyRel - (-0.35));
  if (curveDist >= 0.25 && curveDist <= 0.45 && nx >= -0.25 && nyRel <= 0.0) {
    isSymbol = true;
  }

  // Diagonal slash: from (-0.25, -0.05) to (0.45, 0.7)
  const dX = nx - (-0.2);
  const dY = nyRel - (-0.05);
  const diagDist = Math.abs(dY - 1.05 * dX);
  if (diagDist < 0.13 && nx >= -0.25 && nx <= 0.5 && nyRel >= -0.05 && nyRel <= 0.7) {
    isSymbol = true;
  }

  // Accent upward arrow/flow at top-right
  const arrowDist = Math.hypot(nx - 0.48, nyRel - (-0.6));
  if (arrowDist < 0.12) isSymbol = true;

  if (isSymbol) {
    // Emerald to Mint gradient
    const mix = (nyRel + 1) / 2;
    const rSym = Math.round(16 * (1 - mix) + 52 * mix);
    const gSym = Math.round(185 * (1 - mix) + 211 * mix);
    const bSym = Math.round(129 * (1 - mix) + 153 * mix);
    return [rSym, gSym, bSym, 255];
  }

  // Glow blended with background
  if (glow > 0) {
    const rG = Math.round(rBg + glow * 20);
    const gG = Math.round(gBg + glow * 80);
    const bG = Math.round(bBg + glow * 60);
    return [rG, gG, bG, 255];
  }

  return [rBg, gBg, bBg, 255];
}

const pwa192 = createPng(192, 192, (x, y, w, h) => drawIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), pwa192);

const pwa512 = createPng(512, 512, (x, y, w, h) => drawIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), pwa512);

const pwaMaskable = createPng(512, 512, (x, y, w, h) => drawIcon(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), pwaMaskable);

const appleTouch = createPng(180, 180, (x, y, w, h) => drawIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleTouch);

const favicon = createPng(64, 64, (x, y, w, h) => drawIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'favicon.ico'), favicon);

console.log('Successfully generated all PWA PNG icons!');
