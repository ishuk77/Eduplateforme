import { makeCrudHandlers } from './_helpers.js';

export function registerCommunicationRoutes(router, { service }) {
  const threadHandlers = makeCrudHandlers({
    service,
    resource: 'communicationsThreads',
    create: (body, actorId) => service.createDiscussionThread(body, actorId),
    readPermission: 'communications.read',
    writePermission: 'communications.write'
  });

  const messageHandlers = makeCrudHandlers({
    service,
    resource: 'communicationsMessages',
    create: (body, actorId) => service.postThreadMessage(body, actorId),
    readPermission: 'communications.read',
    writePermission: 'communications.write'
  });

  router.add('POST', '/communications/threads', threadHandlers.create);
  router.add('GET', '/communications/threads', threadHandlers.list);
  router.add('GET', '/communications/threads/:id', threadHandlers.get);
  router.add('PUT', '/communications/threads/:id', threadHandlers.update);
  router.add('DELETE', '/communications/threads/:id', threadHandlers.remove);
  router.add('GET', '/communications/threads/:id/history', threadHandlers.history);

  router.add('POST', '/communications/messages', messageHandlers.create);
  router.add('GET', '/communications/messages', messageHandlers.list);
  router.add('GET', '/communications/messages/:id', messageHandlers.get);
  router.add('PUT', '/communications/messages/:id', messageHandlers.update);
  router.add('DELETE', '/communications/messages/:id', messageHandlers.remove);
  router.add('GET', '/communications/messages/:id/history', messageHandlers.history);
}
