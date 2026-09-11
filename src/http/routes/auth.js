import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { loginSchema, refreshSchema } from '../../shared/types.js';
import { ApiError } from '../../shared/errors.js';

export function registerAuthRoutes(router, { service }) {
  router.add('POST', '/auth/login', async (request) => {
    const body = await parseJson(request, loginSchema);
    return Response.json(await service.authenticate(body));
  });

  router.add('POST', '/auth/refresh', async (request) => {
    const body = await parseJson(request, refreshSchema);
    return Response.json(await service.refreshAuthentication(body.refreshToken));
  });

  router.add('DELETE', '/auth/logout', async (request) => {
    const body = await parseJson(request, refreshSchema);
    const identity = requireIdentity(request, service);
    return Response.json({ ...await service.logout(body.refreshToken, identity.accountId), accountId: identity.accountId });
  });

  router.add('GET', '/auth/me', async (request, url) => {
    const identity = requireIdentity(request, service);
    const requestedOrganizationId = url.searchParams.get('organizationId') ?? null;
    let organizationId = requestedOrganizationId ?? identity.organizationId ?? null;
    if (!organizationId && (identity.organizationIds?.length ?? 0) === 1) {
      [organizationId] = identity.organizationIds;
    }
    if (!organizationId && (identity.organizationIds?.length ?? 0) > 1) {
      throw new ApiError('INVALID_INPUT', 'organizationId is required for multi-organization accounts.', 400);
    }
    authorizeRequest(request, service, { organizationId });
    return Response.json(service.getAuthenticatedUserByAccountId(identity.accountId, organizationId));
  });

  router.add('GET', '/auth/validate', async (request) => {
    const identity = requireIdentity(request, service);
    return Response.json({ authenticated: true, actorId: identity.actorId, organizationId: identity.organizationId });
  });
}
