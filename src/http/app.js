import { createDefaultFoundation } from '../application/foundation-service.js';

export function createApp({ foundation = createDefaultFoundation() } = {}) {
  return async function app(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    if (request.method === 'GET' && url.pathname === '/meta/foundation') {
      return Response.json(foundation.describeFoundation());
    }

    if (request.method === 'GET' && url.pathname === '/meta/invariants') {
      const description = foundation.describeFoundation();

      return Response.json({
        scope: description.scope,
        invariants: description.invariants
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  };
}
