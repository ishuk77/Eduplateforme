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
    const body = await parseJson(request);
    const domain = service.customDomains.get(params.id);
    if (body.accessState === 'suspended'
      && (body.confirmation !== domain?.domain || !String(body.reason ?? '').trim())) {
      throw new ApiError('CONFIRMATION_REQUIRED', 'Suspension requires the exact domain and a reason.', 400);
    }
    return Response.json(await service.governCustomDomain(params.id, body, identity.actorId));
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

  router.add('GET', '/domain-reseller/provider', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.getDomainProviderStatus());
  });

  router.add('GET', '/domain-reseller/catalog', async (request) => {
    requireIdentity(request, service);
    return Response.json(service.listDomainTldCatalog({ enabledOnly: true }));
  });

  router.add('GET', '/platform/domain-reseller/catalog', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.listDomainTldCatalog());
  });

  router.add('PUT', '/platform/domain-reseller/catalog', async (request) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.upsertDomainTld(await parseJson(request), identity.actorId));
  });

  router.add('POST', '/domain-reseller/quotes', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['saas.write']
    });
    return Response.json(await service.quoteDomain(body, identity.actorId), { status: 201 });
  });

  router.add('GET', '/domain-reseller/orders', async (request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    authorizeRequest(request, service, {
      organizationId,
      permissions: ['saas.read']
    });
    return Response.json(service.listDomainOrders(organizationId, { includeRegistrant: true }));
  });

  router.add('POST', '/domain-reseller/orders', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['saas.write']
    });
    return Response.json(await service.createDomainOrder(body, identity.actorId), { status: 201 });
  });

  router.add('PUT', '/domain-reseller/orders/:id/auto-renew', async (request, _url, params) => {
    const order = service.domainOrders.get(params.id);
    if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
    const identity = authorizeRequest(request, service, {
      organizationId: order.organizationId,
      permissions: ['saas.write']
    });
    const body = await parseJson(request);
    return Response.json(await service.setDomainAutoRenew(params.id, body.enabled, identity.actorId));
  });

  router.add('POST', '/domain-reseller/orders/:id/transfer', async (request, _url, params) => {
    const order = service.domainOrders.get(params.id);
    if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
    const identity = authorizeRequest(request, service, {
      organizationId: order.organizationId,
      permissions: ['saas.write']
    });

    router.add('POST', '/domain-reseller/orders/:id/renew', async (request, _url, params) => {
      const order = service.domainOrders.get(params.id);
      if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
      const identity = authorizeRequest(request, service, {
        organizationId: order.organizationId,
        permissions: ['saas.write']
      });
      return Response.json(await service.requestDomainRenewal(params.id, await parseJson(request), identity.actorId));
    });

    router.add('POST', '/domain-reseller/orders/:id/cancel-management', async (request, _url, params) => {
      const order = service.domainOrders.get(params.id);
      if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
      const identity = authorizeRequest(request, service, {
        organizationId: order.organizationId,
        permissions: ['saas.write']
      });
      return Response.json(await service.cancelDomainManagement(params.id, await parseJson(request), identity.actorId));
    });
    return Response.json(await service.requestDomainTransfer(
      params.id,
      await parseJson(request),
      identity.actorId
    ));
  });

  router.add('GET', '/platform/domain-reseller/orders', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.listDomainOrders());
  });

  router.add('POST', '/platform/domain-reseller/orders/:id/payment', async (request, _url, params) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.markDomainOrderPaid(
      params.id,
      await parseJson(request),
      identity.actorId
    ));
  });

  router.add('POST', '/platform/domain-reseller/orders/:id/register', async (request, _url, params) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.submitDomainRegistration(params.id, identity.actorId));
  });

  router.add('PUT', '/platform/domain-reseller/orders/:id/provisioning', async (request, _url, params) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.updateDomainProvisioning(
      params.id,
      await parseJson(request),
      identity.actorId
    ));
  });

  router.add('PUT', '/platform/domain-reseller/orders/:id/reconcile', async (request, _url, params) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.reconcileDomainOrder(
      params.id,
      await parseJson(request),
      identity.actorId
    ));
  });
}
