import http from 'node:http';
import { createApp } from './app.js';

export function createHttpServer(options = {}) {
  const app = createApp(options);

  return http.createServer(async (req, res) => {
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
      method: req.method,
      headers: req.headers
    });

    const response = await app(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  });
}
