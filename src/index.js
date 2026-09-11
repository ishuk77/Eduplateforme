import { createHttpServer } from './http/server.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const server = createHttpServer();

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(port, () => {
    console.log(`Eduplateforme API listening on port ${port}`);
  });
}

export { server };
