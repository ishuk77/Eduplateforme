import { parseJson } from '../middleware/validation.js';
import { bootstrapOrAuthorize, makeCrudHandlers } from './_helpers.js';

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
    const identity = bootstrapOrAuthorize(request, service, body, ['organizations.write']);
    return Response.json(await service.createOrganization(body, identity.actorId), { status: 201 });
  });

  router.add('GET', '/organizations', handlers.list);
  router.add('GET', '/organizations/:id', handlers.get);
  router.add('PUT', '/organizations/:id', handlers.update);
  router.add('DELETE', '/organizations/:id', handlers.remove);
  router.add('GET', '/organizations/:id/history', handlers.history);
}
