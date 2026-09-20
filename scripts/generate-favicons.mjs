import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

function createIco(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image size
  entry.writeUInt32LE(22, 12); // image offset (6 + 16)

  return Buffer.concat([header, entry, pngBuffer]);
}

async function run() {
  const logoPath = path.resolve('public/roi-logo.png');
  const trimmed = await sharp(logoPath).trim().toBuffer();

  const size = 512;
  const radius = size / 2;

  // Dark circular badge matching the brand style
  const circleSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#0d0e14" />
  </svg>`;

  const roiInside = await sharp(trimmed)
    .resize(360, 360, { fit: 'inside' })
    .toBuffer();

  const full512 = await sharp(Buffer.from(circleSvg))
    .composite([{ input: roiInside, gravity: 'centre' }])
    .png()
    .toBuffer();

  // 1. icon.png (512x512)
  await fs.promises.writeFile('src/app/icon.png', full512);
  await fs.promises.writeFile('public/icon.png', full512);
  await fs.promises.writeFile('public/roi-icon.png', full512);

  // 2. apple-icon.png (180x180)
  const apple180 = await sharp(full512).resize(180, 180).png().toBuffer();
  await fs.promises.writeFile('src/app/apple-icon.png', apple180);
  await fs.promises.writeFile('public/apple-icon.png', apple180);

  // 3. favicon.ico (64x64 inside ICO container)
  const ico64Png = await sharp(full512).resize(64, 64).png().toBuffer();
  const icoData = createIco(ico64Png, 64, 64);
  await fs.promises.writeFile('src/app/favicon.ico', icoData);
  await fs.promises.writeFile('public/favicon.ico', icoData);

  // Clean test files
  const testFiles = [
    'public/test-favicon-full.png',
    'public/test-favicon-trans.png',
    'public/test-favicon-circle.png',
    'public/test-favicon-square.png',
    'public/test-favicon-o.png',
    'public/test-32-full.png',
    'public/test-32-o.png',
    'public/test.ico',
  ];
  for (const f of testFiles) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  }

  console.log('ROI icons and favicons generated successfully!');
}

run().catch(console.error);
