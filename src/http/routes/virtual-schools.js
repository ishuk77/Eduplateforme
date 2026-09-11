import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerVirtualSchoolRoutes(router, { service }) {
  router.add('POST', '/virtual-schools', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createVirtualSchool(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/virtual-schools/trainings', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createPaidTraining(body, requireActor(request)), { status: 201 });
  });
}
