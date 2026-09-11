import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { startServer } from '../src/server.js';

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
  process.env.PORT = String(port);

  const logger = { info() {}, error() {} };
  const { server, port: activePort } = await startServer({ logger });

  assert.equal(activePort, port);

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  if (previousPort === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = previousPort;
  }
});
