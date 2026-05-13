// SVG → PNG 変換（Play Store 用アイコン生成）
const sharp = require('sharp');
const fs = require('fs');

async function svgToPng(svgPath, pngPath, size) {
  const svg = fs.readFileSync(svgPath);
  await sharp(svg, { density: 600 })
    .resize(size, size, { fit: 'contain', background: { r:7, g:17, b:28, alpha:1 } })
    .png()
    .toFile(pngPath);
  console.log(`✓ ${pngPath} (${size}x${size})`);
}

async function svgToFeature(svgPath, pngPath, width, height) {
  const svg = fs.readFileSync(svgPath);
  await sharp(svg, { density: 400 })
    .resize(width, height, { fit: 'contain', background: { r:7, g:17, b:28, alpha:1 } })
    .png()
    .toFile(pngPath);
  console.log(`✓ ${pngPath} (${width}x${height})`);
}

(async () => {
  try {
    await svgToPng('icon-512.svg', 'icon-512.png', 512);
    await svgToPng('icon-192.svg', 'icon-192.png', 192);
    await svgToPng('icon-maskable.svg', 'icon-maskable-512.png', 512);
    // フィーチャーグラフィック（1024x500・横長）── icon-512 をベースに
    await svgToFeature('icon-512.svg', 'feature-1024x500.png', 1024, 500);
    console.log('Done.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
