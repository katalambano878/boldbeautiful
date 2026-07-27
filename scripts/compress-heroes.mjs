import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const files = [
  { name: 'hero4.jpeg', width: 1200, quality: 72 },
  { name: 'hero7.jpeg', width: 1920, quality: 72 },
  { name: 'hero8.jpeg', width: 1920, quality: 72 },
  { name: 'hero9.jpeg', width: 1920, quality: 72 },
  { name: 'hero10.jpeg', width: 1920, quality: 72 },
  { name: 'hero-categories.jpeg', width: 1920, quality: 72 },
  { name: 'hero-about-cta.jpeg', width: 1920, quality: 70 },
];

for (const f of files) {
  const src = path.join(publicDir, f.name);
  if (!fs.existsSync(src)) {
    console.error('missing', f.name);
    continue;
  }
  const before = fs.statSync(src).size;
  const tmp = src + '.tmp';
  await sharp(src)
    .rotate()
    .resize({ width: f.width, withoutEnlargement: true })
    .jpeg({ quality: f.quality, mozjpeg: true, progressive: true })
    .toFile(tmp);
  fs.renameSync(tmp, src);
  const after = fs.statSync(src).size;
  console.log(
    `${f.name}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
  );
}
