import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerOrganizationRoutes(router, { service }) {
  router.add('POST', '/organizations', async (request) => {
    const actorId = requireActor(request);
    const body = await parseJson(request);
    return Response.json(service.createOrganization(body, actorId), { status: 201 });
  });
}
