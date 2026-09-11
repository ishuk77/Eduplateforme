import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';

export function getPortFromEnv(env = process.env) {
  const value = env.PORT;

  if (!value) {
    return 3000;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

export async function startServer({ port = getPortFromEnv(), host = '0.0.0.0', logger = console } = {}) {
  const app = createApp();
  const server = createServer(app);

  return await new Promise((resolve, reject) => {
    server.once('error', (error) => {
      logger.error('Server startup failed', { error: error.message, code: error.code, port, host });
      reject(error);
    });

    server.listen(port, host, () => {
      const address = server.address();
      const activePort = typeof address === 'object' && address ? address.port : port;
      logger.info(`Eduplateforme server listening on ${host}:${activePort}`);
      resolve({ server, host, port: activePort });
    });
  });
}

export async function bootstrap() {
  return await startServer();
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === executedFile) {
  bootstrap().catch((error) => {
    console.error('Fatal startup error', error);
    process.exitCode = 1;
  });
}
