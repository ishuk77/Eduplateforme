import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerSecurityRoutes(router, { service }) {
  router.add('POST', '/security/parental-consents', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.recordParentalConsent(body, requireActor(request)), { status: 201 });
  });
}
