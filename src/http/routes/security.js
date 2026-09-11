import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

export function registerSecurityRoutes(router, { service }) {
  router.add('POST', '/security/parental-consents', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['security.write'] });
    return Response.json(service.recordParentalConsent(body, identity.actorId), { status: 201 });
  });
}
