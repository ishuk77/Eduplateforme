import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerUserRoutes(router, { service }) {
  router.add('POST', '/users', async (request) => {
    const actorId = requireActor(request);
    const body = await parseJson(request);
    return Response.json(service.registerPerson(body, actorId), { status: 201 });
  });

  router.add('POST', '/accounts', async (request) => {
    const actorId = requireActor(request);
    const body = await parseJson(request);
    return Response.json(service.openUserAccount(body, actorId), { status: 201 });
  });
}
