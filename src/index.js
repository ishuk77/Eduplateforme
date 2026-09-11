import { createServer } from 'node:http';
import { PersistentEducationPlatformService } from './services/persistent-education-platform-service.js';
import { createAppHandler } from './http/app.js';

const service = PersistentEducationPlatformService.bootstrap({ databasePath: process.env.DATABASE_PATH });
const server = createServer(createAppHandler(service));

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Eduplateforme server listening on :${port}`);
});

function shutdown() {
  if (shutdown.started) {
    return;
  }
  shutdown.started = true;

  server.close(() => {
    service.close();
    process.exit(0);
  });
}
shutdown.started = false;

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
