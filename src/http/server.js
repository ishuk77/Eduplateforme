import http from 'node:http';
import { createApp } from './app.js';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

export function createHttpServer(options = {}) {
  const app = createApp(options);
  const serverBaseUrl = process.env.SERVER_BASE_URL ?? 'http://localhost';

  return http.createServer(async (req, res) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers.set(name, value.join(','));
      } else if (value != null) {
        headers.set(name, String(value));
      }
    }
    headers.set('x-remote-addr', req.socket.remoteAddress ?? '');

    const requestUrl = new URL(req.url ?? '/', serverBaseUrl).toString();
    const request = new Request(requestUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await readBody(req)
    });

    const response = await app(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    const body = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
    res.end(body);
  });
}
