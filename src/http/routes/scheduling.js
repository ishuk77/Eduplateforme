import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

export function registerSchedulingRoutes(router, { service }) {
  router.add('POST', '/scheduling/entries', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['scheduling.write'] });
    return Response.json(await service.createScheduleEntry(body, identity.actorId), { status: 201 });
  });
}
