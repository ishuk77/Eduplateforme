import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerCalendarRoutes(router, { service }) {
  router.add('POST', '/calendar/events', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createCalendarEvent(body, requireActor(request)), { status: 201 });
  });
}
