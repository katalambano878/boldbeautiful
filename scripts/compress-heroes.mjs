import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const files = [
  { name: 'hero-1.jpeg', width: 1600, quality: 72 },
  { name: 'hero-2.jpeg', width: 1600, quality: 72 },
  { name: 'hero-3.png', width: 1400, quality: 72, toJpeg: true },
  { name: 'hero4.jpeg', width: 1200, quality: 72 },
  { name: 'hero7.jpeg', width: 1600, quality: 72 },
  { name: 'hero8.jpeg', width: 1600, quality: 72 },
  { name: 'hero9.jpeg', width: 1600, quality: 72 },
  { name: 'hero10.jpeg', width: 1600, quality: 72 },
  { name: 'hero-categories.jpeg', width: 1600, quality: 72 },
  { name: 'hero-about-cta.jpeg', width: 1600, quality: 70 },
  { name: 'logo.png', width: 320, quality: 80, png: true },
];

for (const f of files) {
  const src = path.join(publicDir, f.name);
  if (!fs.existsSync(src)) {
    console.error('missing', f.name);
    continue;
  }
  const before = fs.statSync(src).size;
  const tmp = src + '.tmp';
  let pipeline = sharp(src).rotate().resize({ width: f.width, withoutEnlargement: true });

  if (f.png) {
    await pipeline.png({ quality: f.quality, compressionLevel: 9 }).toFile(tmp);
  } else if (f.toJpeg) {
    const jpegOut = path.join(publicDir, f.name.replace(/\.png$/i, '.jpeg'));
    await pipeline.jpeg({ quality: f.quality, mozjpeg: true, progressive: true }).toFile(tmp);
    fs.renameSync(tmp, jpegOut);
    if (jpegOut !== src) fs.unlinkSync(src);
    const after = fs.statSync(jpegOut).size;
    console.log(
      `${f.name} -> ${path.basename(jpegOut)}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
    );
    continue;
  } else {
    await pipeline.jpeg({ quality: f.quality, mozjpeg: true, progressive: true }).toFile(tmp);
  }

  fs.renameSync(tmp, src);
  const after = fs.statSync(src).size;
  console.log(
    `${f.name}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
  );
}
