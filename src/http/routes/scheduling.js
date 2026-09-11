import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerSchedulingRoutes(router, { service }) {
  router.add('POST', '/scheduling/entries', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createScheduleEntry(body, requireActor(request)), { status: 201 });
  });
}
