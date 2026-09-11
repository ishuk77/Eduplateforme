import { makeCrudHandlers } from './_helpers.js';

export function registerSecurityRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service, resource: 'parentalConsents',
    create: (body, actorId) => service.recordParentalConsent(body, actorId),
    readPermission: 'security.read', writePermission: 'security.write'
  });
  router.add('POST', '/security/parental-consents', handlers.create);
  router.add('GET', '/security/parental-consents', handlers.list);
  router.add('GET', '/security/parental-consents/:id', handlers.get);
  router.add('PUT', '/security/parental-consents/:id', handlers.update);
  router.add('DELETE', '/security/parental-consents/:id', handlers.remove);
  router.add('GET', '/security/parental-consents/:id/history', handlers.history);
}
