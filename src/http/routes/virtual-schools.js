import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

export function registerVirtualSchoolRoutes(router, { service }) {
  router.add('POST', '/virtual-schools', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['virtual-schools.write'] });
    return Response.json(service.createVirtualSchool(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/virtual-schools/trainings', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['virtual-schools.write'] });
    return Response.json(service.createPaidTraining(body, identity.actorId), { status: 201 });
  });
}
