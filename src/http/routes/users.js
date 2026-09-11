import { parseJson } from '../middleware/validation.js';
import { bootstrapOrAuthorize, makeCrudHandlers } from './_helpers.js';
import { accountCreationSchema } from '../../shared/types.js';

export function registerUserRoutes(router, { service }) {
  const peopleHandlers = makeCrudHandlers({
    service,
    resource: 'people',
    create: (body, actorId) => service.registerPerson(body, actorId),
    readPermission: 'people.read',
    writePermission: 'people.write',
    getOrganizationIdFromBody: (body) => body.primaryOrganizationId ?? body.organizationId ?? null,
    getOrganizationIdFromRecord: (record) => record.primaryOrganizationId ?? null
  });

  const accountHandlers = makeCrudHandlers({
    service,
    resource: 'accounts',
    create: (body, actorId) => service.openUserAccount(body, actorId),
    readPermission: 'accounts.read',
    writePermission: 'accounts.write',
    getOrganizationIdFromBody: (body) => body.organizationId ?? body.organizationIds?.[0] ?? null,
    getOrganizationIdFromRecord: (record) => record.organizationIds?.[0] ?? null
  });

  router.add('POST', '/users', async (request) => {
    const body = await parseJson(request);
    const identity = bootstrapOrAuthorize(request, service, body, ['people.write']);
    return Response.json(await service.registerPerson(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/people', async (request) => {
    const body = await parseJson(request);
    const identity = bootstrapOrAuthorize(request, service, body, ['people.write']);
    return Response.json(await service.registerPerson(body, identity.actorId), { status: 201 });
  });
  router.add('GET', '/people', peopleHandlers.list);
  router.add('GET', '/people/:id', peopleHandlers.get);
  router.add('PUT', '/people/:id', peopleHandlers.update);
  router.add('DELETE', '/people/:id', peopleHandlers.remove);
  router.add('GET', '/people/:id/history', peopleHandlers.history);

  router.add('POST', '/accounts', async (request) => {
    const body = await parseJson(request, accountCreationSchema);
    const identity = bootstrapOrAuthorize(request, service, body, ['accounts.write']);
    return Response.json(await service.openUserAccount(body, identity.actorId), { status: 201 });
  });
  router.add('GET', '/accounts', accountHandlers.list);
  router.add('GET', '/accounts/:id', accountHandlers.get);
  router.add('PUT', '/accounts/:id', accountHandlers.update);
  router.add('DELETE', '/accounts/:id', accountHandlers.remove);
  router.add('GET', '/accounts/:id/history', accountHandlers.history);
}
