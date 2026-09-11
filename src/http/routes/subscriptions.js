import { makeCrudHandlers } from './_helpers.js';

export function registerSubscriptionRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'platformSubscriptions',
    create: (body, actorId) => service.createPlatformSubscription(body, actorId),
    readPermission: 'subscriptions.read',
    writePermission: 'subscriptions.write'
  });

  router.add('POST', '/subscriptions/platform', handlers.create);
  router.add('GET', '/subscriptions/platform', handlers.list);
  router.add('GET', '/subscriptions/platform/:id', handlers.get);
  router.add('PUT', '/subscriptions/platform/:id', handlers.update);
  router.add('DELETE', '/subscriptions/platform/:id', handlers.remove);
  router.add('GET', '/subscriptions/platform/:id/history', handlers.history);
}
