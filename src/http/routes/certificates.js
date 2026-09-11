import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

export function registerCertificateRoutes(router, { service }) {
  router.add('POST', '/certificates', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['certificates.write'] });
    return Response.json(service.issueCertificate(body, identity.actorId), { status: 201 });
  });
}
