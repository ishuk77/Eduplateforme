import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerCertificateRoutes(router, { service }) {
  router.add('POST', '/certificates', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.issueCertificate(body, requireActor(request)), { status: 201 });
  });
}
