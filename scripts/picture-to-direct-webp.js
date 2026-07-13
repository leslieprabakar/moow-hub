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

  // Replace all <picture>...</picture> blocks
  content = content.replace(/<picture>[\s\S]*?<\/picture>/gi, function(match) {
    // Extract the <img> tag from inside
    const imgMatch = match.match(/<img\s[^>]*\/?>/i);
    if (!imgMatch) return match;

    let imgTag = imgMatch[0];

    // Convert src attribute to .webp
    imgTag = imgTag.replace(/src=["']([^"']+)\.(png|jpe?g)["']/i, function(m, srcPath, ext) {
      return `src="${srcPath}.webp"`;
    });

    return imgTag;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`UPDATED ${relPath}`);
  } else {
    console.log(`NO CHANGE ${relPath}`);
  }
}

console.log('\nDone.');
