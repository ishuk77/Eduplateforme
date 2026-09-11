import { pathToFileURL } from 'node:url';

import { readRuntimeConfig } from './config/runtime.js';
import { createHttpServer } from './http/server.js';
import { initializePersistentEducationPlatformService } from './services/persistent-education-platform-service.js';

export async function bootstrap({ env = process.env, logger = console } = {}) {
  const { host, port } = readRuntimeConfig(env);
  const service = await initializePersistentEducationPlatformService({
    databaseUrl: env.DATABASE_URL ?? env.DB_URL
  });
  const server = createHttpServer({ foundation: service });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('error', onError);
      reject(error);
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });

  logger.info(`Eduplateforme API listening on http://${host}:${port}`);
  return { server, service, host, port };
}

async function shutdown({ server, service }, signal, logger = console) {
  logger.info(`Received ${signal}; shutting down.`);
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await service.close();
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === executedFile) {
  bootstrap().then((runtime) => {
    let shuttingDown = false;
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        if (shuttingDown) {
          return;
        }
        shuttingDown = true;
        shutdown(runtime, signal).catch((error) => {
          console.error('Graceful shutdown failed.', error);
          process.exitCode = 1;
        });
      });
    }
  }).catch((error) => {
    console.error('Eduplateforme startup failed.', error);
    process.exitCode = 1;
  });
}
