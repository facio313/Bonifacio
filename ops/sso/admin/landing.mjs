import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

import { landingRedirect } from './landing-redirect.mjs';

const root = '/app/dist';
const port = Number.parseInt(process.env.PORT ?? '80', 10);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const redirect = landingRedirect(
      request.method,
      url.pathname,
      request.headers['remote-groups'],
    );
    if (redirect) {
      response.writeHead(302, {
        'Cache-Control': 'no-store',
        'Content-Length': '0',
        Location: redirect,
        'Referrer-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end();
      return;
    }
    const clean = normalize(decodeURIComponent(url.pathname)).replace(/^([.][.][/\\])+/, '');
    let path = join(root, clean);
    if (!path.startsWith(`${root}/`) && path !== root) throw new Error('invalid path');
    try {
      const metadata = await stat(path);
      if (metadata.isDirectory()) path = join(path, 'index.html');
    } catch {
      path = join(root, 'index.html');
    }
    const extension = extname(path);
    response.writeHead(200, {
      'Cache-Control': path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Type': types[extension] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, '0.0.0.0');
