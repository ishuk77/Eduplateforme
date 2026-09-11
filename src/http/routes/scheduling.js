import { makeCrudHandlers } from './_helpers.js';

export function registerSchedulingRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'scheduleEntries',
    create: (body, actorId) => service.createScheduleEntry(body, actorId),
    readPermission: 'scheduling.read',
    writePermission: 'scheduling.write'
  });
  router.add('POST', '/scheduling/entries', handlers.create);
  router.add('GET', '/scheduling/entries', handlers.list);
  router.add('GET', '/scheduling/entries/:id', handlers.get);
  router.add('PUT', '/scheduling/entries/:id', handlers.update);
  router.add('DELETE', '/scheduling/entries/:id', handlers.remove);
  router.add('GET', '/scheduling/entries/:id/history', handlers.history);
}
