import { makeCrudHandlers } from './_helpers.js';

export function registerCalendarRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'calendar',
    create: (body, actorId) => service.createCalendarEvent(body, actorId),
    readPermission: 'calendar.read',
    writePermission: 'calendar.write'
  });

  router.add('POST', '/calendar/events', handlers.create);
  router.add('GET', '/calendar/events', handlers.list);
  router.add('GET', '/calendar/events/:id', handlers.get);
  router.add('PUT', '/calendar/events/:id', handlers.update);
  router.add('DELETE', '/calendar/events/:id', handlers.remove);
  router.add('GET', '/calendar/events/:id/history', handlers.history);
}
