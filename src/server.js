import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { modules, resolveModule } from './modules.js';
import { renderAppShell } from './template.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = fileURLToPath(new URL('.', import.meta.url));
const publicDirectoryPath = join(currentDirectoryPath, '../public');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

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
  return createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const currentModule = resolveModule(requestUrl.pathname);

    if (currentModule) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderAppShell({ currentModule, modules }));
      return;
    }

    if (requestUrl.pathname === '/styles.css' || requestUrl.pathname === '/app.js' || requestUrl.pathname === '/manifest.webmanifest') {
      await serveStaticAsset(requestUrl.pathname, response);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
}

function startServer() {
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer();

  server.listen(port, () => {
    console.log(`Eduplateforme app shell running on http://localhost:${port}`);
  });
}

if (process.argv[1] === currentFilePath) {
  startServer();
}
