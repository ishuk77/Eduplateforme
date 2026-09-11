import { createServer } from './server.js';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);

export function startServer() {
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer();

  server.listen(port, () => {
    console.log(`Eduplateforme server running on http://localhost:${port}`);
  });

  return server;
}

if (process.argv[1] === currentFilePath) {
  startServer();
}
