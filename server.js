require('dotenv').config({ path: '.env.local' });
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;

const apiHandler = require('./api/index');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { resolve(body); });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Security headers for all responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (url.pathname.startsWith('/api/')) {
    try {
      const body = await parseBody(req);
      req.body = body ? JSON.parse(body) : {};
    } catch { req.body = {}; }

    req.headers = Object.fromEntries(Object.entries(req.headers));
    req.socket = { remoteAddress: req.socket?.remoteAddress || '127.0.0.1' };

    // Provide Express-compatible res methods for the API handler
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };
    res.json = function(data) {
      if (!res.headersSent) res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return res;
    };
    res.end = res.end.bind(res);

    try {
      await apiHandler(req, res);
    } catch (err) {
      console.error('API error:', err);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  const pathname = decodeURIComponent(url.pathname);

  // Clean URL rewrites: /about -> /pages/about.html
  const cleanUrlMap = {
    '/about': '/pages/about.html',
    '/pose-library': '/pages/pose-library.html',
    '/wellness-ai': '/pages/wellness-ai.html',
    '/centers': '/pages/centers.html',
    '/partners': '/pages/partners.html',
    '/products': '/pages/products.html',
    '/services': '/pages/services.html',
    '/contact': '/pages/contact.html',
    '/agreement': '/pages/agreement.html',
    '/product-detail': '/pages/product-detail.html',
    '/privacy-policy': '/pages/privacy-policy.html',
    '/terms-of-service': '/pages/terms-of-service.html',
    '/brand-guidelines': '/pages/brand-guidelines.html',
  };

  const rewrittenPath = cleanUrlMap[pathname] || pathname;
  let filePath = path.join(__dirname, 'public', rewrittenPath === '/' ? 'index.html' : rewrittenPath);

  // If file doesn't exist, try with .html extension
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(__dirname, 'public', rewrittenPath + '.html');
  }

  // If still doesn't exist, serve 404
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'public', '404.html');
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/html';
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(404, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Moow.Hub running at http://localhost:${PORT}`);
});
