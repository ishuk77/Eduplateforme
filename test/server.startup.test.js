import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { createApp } from '../src/app.js';
import { getPortFromEnv, startServer } from '../src/server.js';

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const temp = createServer();
    temp.once('error', reject);
    temp.listen(0, '127.0.0.1', () => {
      const address = temp.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      temp.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

test('server starts with PORT injected by environment', async () => {
  const previousPort = process.env.PORT;
  const port = await getFreePort();
  let server;
  const infoMessages = [];

  try {
    process.env.PORT = String(port);

    const logger = {
      info(message) {
        infoMessages.push(message);
      },
      error() {}
    };
    const started = await startServer({ logger });
    server = started.server;
    assert.equal(started.port, port);
    assert.equal(infoMessages.length, 1);
    assert.match(infoMessages[0], new RegExp(`:${port}$`));
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
});

test('getPortFromEnv returns default port when PORT is missing', () => {
  assert.equal(getPortFromEnv({}), 3000);
});

test('getPortFromEnv rejects invalid PORT values', () => {
  assert.throws(() => getPortFromEnv({ PORT: '3000abc' }), /Invalid PORT value/);
  assert.throws(() => getPortFromEnv({ PORT: '0' }), /Invalid PORT value/);
  assert.throws(() => getPortFromEnv({ PORT: '' }), /Invalid PORT value/);
});

test('app endpoints expose deployment health surface', async () => {
  const port = await getFreePort();
  const logger = { info() {}, error() {} };
  const { server } = await startServer({ port, logger, handler: createApp() });

  try {
    const health = await fetch(`http://127.0.0.1:${port}/health?full=1`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const healthz = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(healthz.status, 200);
    assert.deepEqual(await healthz.json(), { ok: true });

    const root = await fetch(`http://127.0.0.1:${port}/?check=1`);
    assert.equal(root.status, 200);
    assert.deepEqual(await root.json(), { service: 'eduplateforme', status: 'ready' });

    const missing = await fetch(`http://127.0.0.1:${port}/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'NOT_FOUND' });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});
