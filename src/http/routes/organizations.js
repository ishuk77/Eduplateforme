import { parseJson } from '../middleware/validation.js';
import { bootstrapOrAuthorize } from './_helpers.js';

export function registerOrganizationRoutes(router, { service }) {
  router.add('POST', '/organizations', async (request) => {
    const body = await parseJson(request);
    const identity = bootstrapOrAuthorize(request, service, body, ['organizations.write']);
    return Response.json(service.createOrganization(body, identity.actorId), { status: 201 });
  });
}
