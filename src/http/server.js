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

  return http.createServer(async (req, res) => {
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await readBody(req)
    });

    const response = await app(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  });
}
