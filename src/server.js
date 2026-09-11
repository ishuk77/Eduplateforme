import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './http/app.js';
import { modules, resolveModule } from './modules.js';
import { renderAppShell } from './template.js';

const currentDirectoryPath = fileURLToPath(new URL('.', import.meta.url));
const publicDirectoryPath = join(currentDirectoryPath, '../public');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

async function serveStaticAsset(pathname, response) {
  const relativePath = pathname.replace(/^\/+/, '');
  const assetPath = normalize(join(publicDirectoryPath, relativePath));

  if (!assetPath.startsWith(publicDirectoryPath)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  try {
    const asset = await readFile(assetPath);
    response.writeHead(200, {
      'content-type': contentTypes[extname(assetPath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(asset);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

export function createServer() {
  const app = createApp();

  return createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const currentModule = resolveModule(requestUrl.pathname);

    if (request.method === 'GET' && currentModule) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderAppShell({ currentModule, modules }));
      return;
    }

    if (requestUrl.pathname === '/styles.css' || requestUrl.pathname === '/app.js' || requestUrl.pathname === '/manifest.webmanifest') {
      await serveStaticAsset(requestUrl.pathname, response);
      return;
    }

    const appRequest = new Request(`http://${request.headers.host ?? 'localhost'}${requestUrl.pathname}`, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method ?? 'GET') ? undefined : await readBody(request)
    });
    const appResponse = await app(appRequest);

    response.writeHead(appResponse.status, Object.fromEntries(appResponse.headers.entries()));
    response.end(await appResponse.text());
  });
}
