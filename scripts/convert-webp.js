const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const files = fs.readdirSync(imagesDir).filter(f => /\.(jpe?g)$/i.test(f));

(async () => {
  for (const file of files) {
    const input = path.join(imagesDir, file);
    const output = path.join(imagesDir, file.replace(/\.(jpe?g)$/i, '.webp'));
    if (fs.existsSync(output)) {
      console.log(`SKIP ${file} → already exists`);
      continue;
    }
    await sharp(input).webp({ quality: 80 }).toFile(output);
    console.log(`OK   ${file} → ${path.basename(output)}`);
  }
  console.log('\nDone!');
})();
