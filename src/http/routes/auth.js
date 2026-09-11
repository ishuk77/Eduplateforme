import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { loginSchema, refreshSchema } from '../../shared/types.js';

export function registerAuthRoutes(router, { service }) {
  router.add('POST', '/auth/login', async (request) => {
    const body = await parseJson(request, loginSchema);
    return Response.json(service.authenticate(body));
  });

  router.add('POST', '/auth/refresh', async (request) => {
    const body = await parseJson(request, refreshSchema);
    return Response.json(service.refreshAuthentication(body.refreshToken));
  });

  router.add('DELETE', '/auth/logout', async (request) => {
    const body = await parseJson(request, refreshSchema);
    const identity = requireIdentity(request, service);
    return Response.json({ ...service.logout(body.refreshToken), accountId: identity.accountId });
  });

  router.add('GET', '/auth/me', async (request) => {
    const identity = requireIdentity(request, service);
    authorizeRequest(request, service, { organizationId: identity.organizationId });
    return Response.json(service.getAuthenticatedUserByAccountId(identity.accountId, identity.organizationId));
  });

  router.add('GET', '/auth/validate', async (request) => {
    const identity = requireIdentity(request, service);
    return Response.json({ authenticated: true, actorId: identity.actorId, organizationId: identity.organizationId });
  });
}
