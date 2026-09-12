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

function requireTenantAdmin(request, service, organizationId, permissions) {
  const identity = authorizeRequest(request, service, { organizationId, permissions });
  const roles = service.getRoleCodes(identity.accountId, organizationId);
  if (roles.includes('platform-admin')
    || !roles.some((role) => ['tenant-admin', 'school-admin', 'university-admin', 'training-center-admin'].includes(role))) {
    throw new ApiError('FORBIDDEN', 'Institution administrator access is required.', 403);
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

  router.add('GET', '/domain-reseller/destination', async (request) => {
    const identity = requireIdentity(request, service);
    const roles = identity.organizationIds.flatMap((organizationId) =>
      service.getRoleCodes(identity.accountId, organizationId));
    const path = roles.includes('platform-admin')
      ? '/platform/domain-reseller'
      : roles.some((role) => ['tenant-admin', 'school-admin', 'university-admin', 'training-center-admin'].includes(role))
        ? '/domain-subscription'
        : '/dashboard';
    return Response.json({ path });
  });

  router.add('GET', '/platform/domain-reseller/provider', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.getDomainProviderStatus());
  });

  router.add('GET', '/domain-subscription/offers', async (request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    requireTenantAdmin(request, service, organizationId, ['saas.read']);
    return Response.json(service.listEnabledDomainOffers());
  });

  router.add('GET', '/platform/domain-reseller/catalog', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.listDomainTldCatalog());
  });

  router.add('PUT', '/platform/domain-reseller/catalog', async (request) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.upsertDomainTld(await parseJson(request), identity.actorId));
  });

  router.add('POST', '/domain-subscription/quotes', async (request) => {
    const body = await parseJson(request);
    const identity = requireTenantAdmin(request, service, body.organizationId, ['saas.write']);
    return Response.json(await service.quoteDomain(body, identity.actorId), { status: 201 });
  });

  router.add('GET', '/domain-subscription/orders', async (request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    requireTenantAdmin(request, service, organizationId, ['saas.read']);
    return Response.json(service.listDomainOrders(organizationId, { includeRegistrant: true }));
  });

  router.add('POST', '/domain-subscription/orders', async (request) => {
    const body = await parseJson(request);
    const identity = requireTenantAdmin(request, service, body.organizationId, ['saas.write']);
    return Response.json(await service.createDomainOrder(body, identity.actorId), { status: 201 });
  });

  router.add('PUT', '/domain-subscription/orders/:id/auto-renew', async (request, _url, params) => {
    const order = service.domainOrders.get(params.id);
    if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
    const identity = requireTenantAdmin(request, service, order.organizationId, ['saas.write']);
    const body = await parseJson(request);
    return Response.json(await service.setDomainAutoRenew(params.id, body.enabled, identity.actorId));
  });

  router.add('POST', '/domain-subscription/orders/:id/transfer', async (request, _url, params) => {
    const order = service.domainOrders.get(params.id);
    if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
    const identity = requireTenantAdmin(request, service, order.organizationId, ['saas.write']);
    return Response.json(await service.requestDomainTransfer(
      params.id,
      await parseJson(request),
      identity.actorId
    ));
  });

  router.add('POST', '/domain-subscription/orders/:id/renew', async (request, _url, params) => {
    const order = service.domainOrders.get(params.id);
    if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
    const identity = requireTenantAdmin(request, service, order.organizationId, ['saas.write']);
    return Response.json(await service.requestDomainRenewal(params.id, await parseJson(request), identity.actorId));
  });

  router.add('POST', '/domain-subscription/orders/:id/cancel-management', async (request, _url, params) => {
    const order = service.domainOrders.get(params.id);
    if (!order) throw new ApiError('NOT_FOUND', 'Domain order not found.', 404);
    const identity = requireTenantAdmin(request, service, order.organizationId, ['saas.write']);
    return Response.json(await service.cancelDomainManagement(params.id, await parseJson(request), identity.actorId));
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

  router.add('GET', '/platform/domain-reseller/incidents', async (request) => {
    requirePlatformAdmin(request, service);
    return Response.json(service.listDomainResellerIncidents());
  });

  router.add('POST', '/platform/domain-reseller/incidents', async (request) => {
    const identity = requirePlatformAdmin(request, service);
    return Response.json(await service.createDomainResellerIncident(await parseJson(request), identity.actorId), {
      status: 201
    });
  });

  router.add('GET', '/platform/domain-reseller/audit', async (request, url) => {
    requirePlatformAdmin(request, service);
    return Response.json(await service.getDomainResellerAudit({
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset')
    }));
  });
}
