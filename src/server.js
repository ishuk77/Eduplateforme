import { createHttpServer } from './http/server.js';

export function createServer(options = {}) {
  return createHttpServer(options);
}
