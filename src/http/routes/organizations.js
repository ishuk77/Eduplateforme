import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';

export function registerOrganizationRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'organizations',
    create: (body, actorId) => service.createOrganization(body, actorId),
    readPermission: 'organizations.read',
    writePermission: 'organizations.write',
    getOrganizationIdFromBody: (body) => body.id ?? body.organizationId ?? null,
    getOrganizationIdFromRecord: (record) => record.id
  });

  router.add('POST', '/organizations', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.parentOrganizationId ?? null,
      permissions: ['organizations.write']
    });
    return Response.json(
      await service.createOrganizationForAccount(identity.accountId, body),
      { status: 201 }
    );
  });

  router.add('GET', '/organizations', async (request, url) => {
    const identity = requireIdentity(request, service);
    const authorizedOrganizationIds = identity.organizationIds.filter((organizationId) => {
      const permissions = service.getAccountPermissions(identity.accountId, organizationId);
      return permissions.includes('*') || permissions.includes('organizations.read');
    });
    if (authorizedOrganizationIds.length === 0) {
      return Response.json({
        items: [],
        page: {
          total: 0,
          limit: Number(url.searchParams.get('limit') ?? 25),
          offset: Number(url.searchParams.get('offset') ?? 0)
        }
      });
    }
    return Response.json(await service.listCrudResource('organizations', {
      organizationIds: authorizedOrganizationIds,
      includeArchived: url.searchParams.get('includeArchived') === 'true',
      limit: Number(url.searchParams.get('limit') ?? 25),
      offset: Number(url.searchParams.get('offset') ?? 0)
    }));
  });
  router.add('GET', '/organizations/:id', handlers.get);
  router.add('PUT', '/organizations/:id', handlers.update);
  router.add('DELETE', '/organizations/:id', handlers.remove);
  router.add('GET', '/organizations/:id/history', handlers.history);
}
