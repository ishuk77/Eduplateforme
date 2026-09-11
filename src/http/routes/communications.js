import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerCommunicationRoutes(router, { service }) {
  router.add('POST', '/communications/threads', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createDiscussionThread(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/communications/messages', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.postThreadMessage(body, requireActor(request)), { status: 201 });
  });
}
