import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';

export function registerDocumentRoutes(router, { service }) {
  const documentHandlers = makeCrudHandlers({
    service,
    resource: 'documents',
    create: (body, actorId) => service.registerDocument(body, actorId),
    readPermission: 'documents.read',
    writePermission: 'documents.write'
  });

  const credentialHandlers = makeCrudHandlers({
    service,
    resource: 'credentials',
    create: (body, actorId) => service.issueCredential(body, actorId),
    readPermission: 'credentials.read',
    writePermission: 'credentials.write'
  });

  router.add('POST', '/documents', documentHandlers.create);
  router.add('GET', '/documents', documentHandlers.list);
  router.add('GET', '/documents/:id', documentHandlers.get);
  router.add('PUT', '/documents/:id', documentHandlers.update);
  router.add('DELETE', '/documents/:id', documentHandlers.remove);
  router.add('GET', '/documents/:id/history', documentHandlers.history);

  router.add('POST', '/documents/versions', async (request) => {
    const body = await parseJson(request);
    const previous = service.getCrudResource('documents', body.previousDocumentId);
    const identity = authorizeRequest(request, service, {
      organizationId: previous.organizationId,
      permissions: ['documents.write']
    });
    return Response.json(service.registerDocumentVersion(body.previousDocumentId, body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/credentials', credentialHandlers.create);
  router.add('GET', '/credentials', credentialHandlers.list);
  router.add('GET', '/credentials/:id', credentialHandlers.get);
  router.add('PUT', '/credentials/:id', credentialHandlers.update);
  router.add('DELETE', '/credentials/:id', credentialHandlers.remove);
  router.add('GET', '/credentials/:id/history', credentialHandlers.history);

  router.add('POST', '/credentials/revisions', async (request) => {
    const body = await parseJson(request);
    const previous = service.getCrudResource('credentials', body.previousCredentialId);
    const identity = authorizeRequest(request, service, {
      organizationId: previous.organizationId,
      permissions: ['credentials.write']
    });
    return Response.json(service.issueCredentialRevision(body.previousCredentialId, body, identity.actorId), { status: 201 });
  });
}
