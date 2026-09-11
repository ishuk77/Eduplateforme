import { makeCrudHandlers } from './_helpers.js';

export function registerCertificateRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service, resource: 'certificates',
    create: (body, actorId) => service.issueCertificate(body, actorId),
    readPermission: 'certificates.read', writePermission: 'certificates.write'
  });
  router.add('POST', '/certificates', handlers.create);
  router.add('GET', '/certificates', handlers.list);
  router.add('GET', '/certificates/:id', handlers.get);
  router.add('PUT', '/certificates/:id', handlers.update);
  router.add('DELETE', '/certificates/:id', handlers.remove);
  router.add('GET', '/certificates/:id/history', handlers.history);
}
