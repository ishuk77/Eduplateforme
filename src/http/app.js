import { createDefaultFoundation } from '../application/foundation-service.js';

export function createApp({ foundation = createDefaultFoundation() } = {}) {
  return async function app(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    if (request.method === 'GET' && url.pathname === '/meta/foundation') {
      return Response.json({
        name: 'Eduplateforme',
        scope: 'initial-foundation',
        summary: foundation.summarize(),
        modules: [
          'organizations',
          'people',
          'accounts',
          'authorization',
          'academics',
          'documents',
          'audit'
        ]
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  };
}
