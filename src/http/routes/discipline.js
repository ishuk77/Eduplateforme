import { makeCrudHandlers } from './_helpers.js';

export function registerDisciplineRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'discipline',
    create: (body, actorId) => service.recordDiscipline(body, actorId),
    readPermission: 'discipline.read',
    writePermission: 'discipline.write'
  });

  router.add('POST', '/discipline/records', handlers.create);
  router.add('GET', '/discipline/records', handlers.list);
  router.add('GET', '/discipline/records/:id', handlers.get);
  router.add('PUT', '/discipline/records/:id', handlers.update);
  router.add('DELETE', '/discipline/records/:id', handlers.remove);
  router.add('GET', '/discipline/records/:id/history', handlers.history);
}
