// Local dev server: serves the game, plus a small API for the dev feedback overlay.
// Run:  node server.js   then open http://localhost:8080
// Env:  PORT (default 8080), FEEDBACK_DIR (default ./feedback)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { FeedbackStore, HttpError } = require('./tools/feedback-store');

const PORT = Number(process.env.PORT) || 8080;
const HOST = '127.0.0.1'; // only this computer can reach the server
const ROOT = __dirname;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  // The birthday card's own owner-supplied media (docs/STORY.md "How to put your photos and
  // messages in"): without a real Content-Type here, the fallback below serves them as
  // application/octet-stream, which Chromium's <video>/<img> handling can refuse to play/decode
  // even though the bytes are fine -- these formats are the ones that doc promises work.
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  // The vendored Press Start 2P font (ADR 0010, vendor/press-start-2p/): without a real
  // Content-Type here it falls back to application/octet-stream below, which some browsers refuse
  // to use as a @font-face source even though the bytes are fine (same class of issue as the
  // card's media types above).
  '.woff2': 'font/woff2',
};

const store = new FeedbackStore(process.env.FEEDBACK_DIR || path.join(ROOT, 'feedback'));
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
})();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'Body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, urlPath) {
  if (req.method === 'GET' && urlPath === '/api/dev') return sendJson(res, 200, { dev: true, commit });

  if (urlPath === '/api/feedback') {
    if (req.method === 'GET') return sendJson(res, 200, store.list());
    if (req.method === 'POST') return sendJson(res, 201, store.create(await readJson(req)));
  }

  const match = urlPath.match(/^\/api\/feedback\/(FB-\d+)\/(screenshot|reply|verify|reopen)$/);
  if (match) {
    const [, id, action] = match;
    if (action === 'screenshot' && req.method === 'GET') {
      const file = store.screenshotPath(id);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === 'POST') {
      const { text } = await readJson(req);
      if (action === 'reply') return sendJson(res, 200, store.ownerReply(id, text));
      if (action === 'verify') return sendJson(res, 200, store.ownerVerify(id, text));
      if (action === 'reopen') return sendJson(res, 200, store.ownerReopen(id, text));
    }
  }

  throw new HttpError(404, `No API route for ${req.method} ${urlPath}`);
}

function serveStatic(res, urlPath) {
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(ROOT, path.normalize(urlPath));
  const relative = path.relative(ROOT, file);
  const outside = !file.startsWith(ROOT + path.sep);
  const hidden = relative.split(path.sep).some((part) => part.startsWith('.') || part === 'node_modules');
  if (outside || hidden) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

http
  .createServer(async (req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400);
      return res.end('Bad request');
    }

    if (!urlPath.startsWith('/api/')) return serveStatic(res, urlPath);
    try {
      await handleApi(req, res, urlPath);
    } catch (err) {
      if (!err.status) console.error(err);
      sendJson(res, err.status || 500, { error: err.message });
    }
  })
  .listen(PORT, HOST, () => console.log(`Game running at http://localhost:${PORT}`));
