import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { ApiError } from '../../shared/errors.js';

function requirePlatformAdmin(request, service) {
  const identity = requireIdentity(request, service);
  const roles = identity.organizationIds.flatMap((organizationId) =>
    service.getRoleCodes(identity.accountId, organizationId));
  if (!roles.includes('platform-admin')) {
    throw new ApiError('FORBIDDEN', 'Platform administrator access is required.', 403);
  }
  return identity;
}

export function registerDomainRoutes(router, { service }) {
  router.add('GET', '/domains', async (request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    authorizeRequest(request, service, { organizationId, permissions: ['organizations.read'] });
    return Response.json(service.listCustomDomains(organizationId));
  });

  router.add('POST', '/domains', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['organizations.write']
    });
    return Response.json(await service.configureCustomDomain(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/domains/:id/verify', async (request, _url, params) => {
    const domain = service.customDomains.get(params.id);
    if (!domain) throw new ApiError('NOT_FOUND', 'Custom domain not found.', 404);
    const identity = authorizeRequest(request, service, {
      organizationId: domain.organizationId,
      permissions: ['organizations.write']
    });
    return Response.json(await service.verifyCustomDomain(params.id, identity.actorId));
  });

  router.add('GET', '/platform/governance/domains', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.listDomainGovernance());
  });

  router.add('PUT', '/platform/governance/domains/:id', async (request, _url, params) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.governCustomDomain(params.id, await parseJson(request), identity.actorId));
  });

  router.add('PUT', '/platform/governance/subscriptions/:id', async (request, _url, params) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.governPlatformSubscription(params.id, await parseJson(request), identity.actorId));
  });

  router.add('GET', '/public/tenant-context', async (_request, url) => {
    const tenant = service.resolveVerifiedTenantByHost(url.hostname);
    return Response.json(tenant ? {
      organizationId: tenant.organizationId,
      displayName: service.organizations.get(tenant.organizationId)?.displayName ?? null,
      domain: tenant.domain
    } : { organizationId: null });
  });
}
