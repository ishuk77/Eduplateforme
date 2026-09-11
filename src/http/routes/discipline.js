import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerDisciplineRoutes(router, { service }) {
  router.add('POST', '/discipline/records', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.recordDiscipline(body, requireActor(request)), { status: 201 });
  });
}
