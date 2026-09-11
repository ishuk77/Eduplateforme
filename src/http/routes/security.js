import { makeCrudHandlers } from './_helpers.js';
import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

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

  const consentHandlers = makeCrudHandlers({
    service,
    resource: 'consents',
    create: (body, actorId) => service.recordConsent(body, actorId),
    readPermission: 'consents.read',
    writePermission: 'consents.write'
  });
  router.add('POST', '/security/consents', consentHandlers.create);
  router.add('GET', '/security/consents', consentHandlers.list);
  router.add('GET', '/security/consents/:id', consentHandlers.get);
  router.add('GET', '/security/consents/:id/history', consentHandlers.history);
  router.add('POST', '/security/consents/:id/withdraw', async (request, _url, params) => {
    const consent = await service.getCrudResource('consents', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: consent.organizationId,
      permissions: ['consents.write']
    });
    return Response.json(await service.withdrawConsent(params.id, body, identity.actorId));
  });
}
