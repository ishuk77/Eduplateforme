import { createServer } from 'node:http';
import { PersistentEducationPlatformService } from './services/persistent-education-platform-service.js';
import { createAppHandler } from './http/app.js';

const service = PersistentEducationPlatformService.bootstrap({ databasePath: process.env.DATABASE_PATH });
const server = createServer(createAppHandler(service));

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('Invalid PORT value. Expected an integer between 1 and 65535.');
}
server.listen(port, () => {
  console.log(`Eduplateforme server listening on :${port}`);
});

function shutdown() {
  if (shutdown.started) {
    return;
  }
  shutdown.started = true;

  const finalize = () => {
    if (!shutdown.serviceClosed) {
      shutdown.serviceClosed = true;
      service.close();
    }
    process.exitCode = 0;
  };

  if (server.listening) {
    server.close(finalize);
    return;
  }

  finalize();
}
shutdown.started = false;
shutdown.serviceClosed = false;

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
