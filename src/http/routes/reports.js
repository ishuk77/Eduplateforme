import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerReportRoutes(router, { service }) {
  router.add('POST', '/reports/cards', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.generateReportCard(body, requireActor(request)), { status: 201 });
  });
}
