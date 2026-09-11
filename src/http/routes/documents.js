import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerDocumentRoutes(router, { service }) {
  router.add('POST', '/documents', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.registerDocument(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/documents/versions', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.registerDocumentVersion(body.previousDocumentId, body, requireActor(request)), { status: 201 });
  });
}
