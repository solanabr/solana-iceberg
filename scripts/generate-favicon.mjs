/**
 * Generate favicon.png and favicon.ico from favicon.svg using sharp.
 * Produces 32x32 PNG (standard browser tab size) and multi-size ICO.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");

const svgBuffer = readFileSync(resolve(publicDir, "favicon.svg"));

// Generate 32x32 PNG
await sharp(svgBuffer, { density: 300 })
  .resize(32, 32)
  .png()
  .toFile(resolve(publicDir, "favicon-32.png"));

// Generate 64x64 PNG for higher-DPI tabs
await sharp(svgBuffer, { density: 300 })
  .resize(64, 64)
  .png()
  .toFile(resolve(publicDir, "favicon.png"));

// Generate 16x16 and 32x32 PNGs, then pack into ICO format manually.
// ICO = header (6 bytes) + entries (16 bytes each) + PNG data.
const png16 = await sharp(svgBuffer, { density: 300 })
  .resize(16, 16)
  .png()
  .toBuffer();

const png32 = await sharp(svgBuffer, { density: 300 })
  .resize(32, 32)
  .png()
  .toBuffer();

// ICO file structure: ICONDIR header + ICONDIRENTRY per image + image data
const images = [
  { size: 16, data: png16 },
  { size: 32, data: png32 },
];
const headerSize = 6;
const entrySize = 16;
const dataOffset = headerSize + entrySize * images.length;

// ICONDIR header
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = ICO
header.writeUInt16LE(images.length, 4);

// ICONDIRENTRY for each image
let currentOffset = dataOffset;
const entries = images.map((img) => {
  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width (0 = 256)
  entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(img.data.length, 8); // image data size
  entry.writeUInt32LE(currentOffset, 12); // offset to image data
  currentOffset += img.data.length;
  return entry;
});

const ico = Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
writeFileSync(resolve(publicDir, "favicon.ico"), ico);

console.log("Generated: favicon.png (64x64), favicon-32.png (32x32), favicon.ico (16+32)");
