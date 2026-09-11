import { createServer } from 'node:http';
import { PersistentEducationPlatformService } from './services/persistent-education-platform-service.js';

const service = PersistentEducationPlatformService.bootstrap({
  databasePath: process.env.DATABASE_PATH
});

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'POST' && req.url === '/organizations') {
    try {
      const body = await parseBody(req);
      const organization = service.registerOrganization({
        name: body.name,
        code: body.code,
        actorId: body.actorId ?? null
      });
      sendJson(res, 201, { organization });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: 'NOT_FOUND' });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Eduplateforme server listening on :${port}`);
});

function shutdown() {
  server.close(() => {
    service.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
