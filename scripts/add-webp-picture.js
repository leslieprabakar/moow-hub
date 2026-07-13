const fs = require('fs');
const path = require('path');

const htmlFiles = [
  'public/index.html',
  'public/pages/services.html',
  'public/pages/contact.html',
  'public/pages/partners.html',
  'public/pages/products.html',
  'public/pages/about.html',
];

for (const relPath of htmlFiles) {
  const filePath = path.join(__dirname, '..', relPath);
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Split by <picture...>...</picture> blocks to avoid double-wrapping
  const parts = [];
  let lastEnd = 0;
  const picRegex = /<picture[\s\S]*?<\/picture>/gi;
  let match;
  picRegex.lastIndex = 0;
  while ((match = picRegex.exec(content)) !== null) {
    parts.push({ text: content.slice(lastEnd, match.index), insidePicture: false });
    parts.push({ text: match[0], insidePicture: true });
    lastEnd = picRegex.lastIndex;
  }
  parts.push({ text: content.slice(lastEnd), insidePicture: false });

  // Process non-picture parts: wrap standalone <img> tags with .jpg/.jpeg src
  const imgRegex = /<img\s[^>]*src=["'][^"']*\.(jpe?g)["'][^>]*\/?>/gi;
  for (const part of parts) {
    if (!part.insidePicture) {
      part.text = part.text.replace(imgRegex, function(imgTag) {
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
        if (!srcMatch) return imgTag;
        const src = srcMatch[1];
        const webpSrc = src.replace(/\.(jpe?g)$/i, '.webp');
        return `<picture>\n                <source srcset="${webpSrc}" type="image/webp">\n                ${imgTag}\n              </picture>`;
      });
    }
  }

  content = parts.map(p => p.text).join('');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`UPDATED ${relPath}`);
  } else {
    console.log(`NO CHANGE ${relPath}`);
  }
}

console.log('\nDone.');
