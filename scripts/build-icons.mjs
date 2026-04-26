// SVG -> .png (1024, 512), .icns (macOS), .ico (Windows)
// Çalıştır: node scripts/build-icons.mjs
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const execFileP = promisify(execFile);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SVG = path.join(ROOT, 'build', 'icon.svg');
const BUILD = path.join(ROOT, 'build');
const ICONSET = path.join(BUILD, 'icon.iconset');

async function svgToPng(svgBuffer, size, outFile) {
  await sharp(svgBuffer, { density: Math.max(72, size / 4) })
    .resize(size, size)
    .png()
    .toFile(outFile);
  console.log(`✓ ${path.relative(ROOT, outFile)} (${size}×${size})`);
}

async function main() {
  const svgBuffer = await fs.readFile(SVG);

  const mainPng = path.join(BUILD, 'icon.png');
  await svgToPng(svgBuffer, 1024, mainPng);
  await svgToPng(svgBuffer, 512, path.join(BUILD, 'icon-512.png'));

  await fs.rm(ICONSET, { recursive: true, force: true });
  await fs.mkdir(ICONSET, { recursive: true });

  const iconsetSizes = [
    { size: 16,   name: 'icon_16x16.png' },
    { size: 32,   name: 'icon_16x16@2x.png' },
    { size: 32,   name: 'icon_32x32.png' },
    { size: 64,   name: 'icon_32x32@2x.png' },
    { size: 128,  name: 'icon_128x128.png' },
    { size: 256,  name: 'icon_128x128@2x.png' },
    { size: 256,  name: 'icon_256x256.png' },
    { size: 512,  name: 'icon_256x256@2x.png' },
    { size: 512,  name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];

  for (const { size, name } of iconsetSizes) {
    await svgToPng(svgBuffer, size, path.join(ICONSET, name));
  }

  const icnsOut = path.join(BUILD, 'icon.icns');
  try {
    await execFileP('iconutil', ['-c', 'icns', '-o', icnsOut, ICONSET]);
    console.log(`✓ ${path.relative(ROOT, icnsOut)}`);
  } catch (e) {
    console.warn('⚠ iconutil bulunamadı (sadece macOS), .icns atlandı:', e.message);
  }

  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map(s =>
      sharp(svgBuffer, { density: Math.max(72, s / 4) }).resize(s, s).png().toBuffer()
    )
  );
  const icoBuffer = await pngToIco(icoBuffers);
  const icoOut = path.join(BUILD, 'icon.ico');
  await fs.writeFile(icoOut, icoBuffer);
  console.log(`✓ ${path.relative(ROOT, icoOut)}`);

  await fs.rm(ICONSET, { recursive: true, force: true });
  console.log('\n🎨 Tüm ikonlar build/ klasöründe hazır.');
}

main().catch((e) => { console.error(e); process.exit(1); });
