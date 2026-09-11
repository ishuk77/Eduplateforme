import { makeCrudHandlers } from './_helpers.js';

export function registerReportRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'reportCards',
    create: (body, actorId) => service.generateReportCard(body, actorId),
    readPermission: 'reports.read',
    writePermission: 'reports.write'
  });

  router.add('POST', '/reports/cards', handlers.create);
  router.add('GET', '/reports/cards', handlers.list);
  router.add('GET', '/reports/cards/:id', handlers.get);
  router.add('PUT', '/reports/cards/:id', handlers.update);
  router.add('DELETE', '/reports/cards/:id', handlers.remove);
  router.add('GET', '/reports/cards/:id/history', handlers.history);
}
