/**
 * Recompress product/category images under STORAGE_ROOT (or arg path).
 * Usage: node scripts/compress-storage-images.mjs [/path/to/storage]
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(process.argv[2] || process.env.STORAGE_ROOT || '.storage');
const MAX_W = 1400;
const QUALITY = 72;
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (exts.has(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

const files = walk(root);
let saved = 0;
for (const file of files) {
  const before = fs.statSync(file).size;
  if (before < 80 * 1024) continue; // already small
  const tmp = file + '.tmpopt';
  try {
    const ext = path.extname(file).toLowerCase();
    let pipeline = sharp(file).rotate().resize({ width: MAX_W, withoutEnlargement: true });
    if (ext === '.png') {
      await pipeline.png({ compressionLevel: 9, quality: QUALITY }).toFile(tmp);
    } else if (ext === '.webp') {
      await pipeline.webp({ quality: QUALITY }).toFile(tmp);
    } else {
      await pipeline.jpeg({ quality: QUALITY, mozjpeg: true, progressive: true }).toFile(tmp);
    }
    const after = fs.statSync(tmp).size;
    if (after < before * 0.95) {
      fs.renameSync(tmp, file);
      saved += before - after;
      console.log(`${path.relative(root, file)}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
    } else {
      fs.unlinkSync(tmp);
    }
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.error('skip', file, e.message);
  }
}
console.log(`Done. Saved ~${(saved / 1024 / 1024).toFixed(2)} MB across ${files.length} files under ${root}`);
