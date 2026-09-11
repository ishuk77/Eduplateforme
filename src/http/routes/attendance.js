import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerAttendanceRoutes(router, { service }) {
  router.add('POST', '/attendance/records', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.recordAttendance(body, requireActor(request)), { status: 201 });
  });

  router.add('GET', '/attendance/rate', async (_request, url) => {
    return Response.json(service.getAttendanceRate({
      organizationId: url.searchParams.get('organizationId'),
      learnerId: url.searchParams.get('learnerId')
    }));
  });
}
