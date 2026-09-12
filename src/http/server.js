import http from 'node:http';
import { createApp } from './app.js';

async function readBody(req) {
  const maxBytes = Number.parseInt(process.env.HTTP_BODY_LIMIT_BYTES ?? String(12 * 1024 * 1024), 10);
  const declaredLength = Number(req.headers['content-length'] ?? 0);
  if (declaredLength > maxBytes) {
    const error = new Error(`Request body exceeds ${maxBytes} bytes.`);
    error.code = 'PAYLOAD_TOO_LARGE';
    throw error;
  }
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of req) {
    byteLength += chunk.length;
    if (byteLength > maxBytes) {
      const error = new Error(`Request body exceeds ${maxBytes} bytes.`);
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
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
    try {
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
    } catch (error) {
      req.resume();
      const status = error?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
      if (!res.headersSent) {
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'x-content-type-options': 'nosniff'
        });
        res.end(JSON.stringify({
          error: {
            code: error?.code === 'PAYLOAD_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
            message: error?.code === 'PAYLOAD_TOO_LARGE' ? error.message : 'Internal server error'
          }
        }));
      } else {
        res.destroy();
      }
    }
  });
}
