import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';

function registerCrud(router, { service, path, resource, create, readPermission, writePermission, mutable = true }) {
  const handlers = makeCrudHandlers({
    service,
    resource,
    create,
    readPermission,
    writePermission
  });
  router.add('POST', path, handlers.create);
  router.add('GET', path, handlers.list);
  router.add('GET', `${path}/:id`, handlers.get);
  if (mutable) {
    router.add('PUT', `${path}/:id`, handlers.update);
    router.add('DELETE', `${path}/:id`, handlers.remove);
  }
  router.add('GET', `${path}/:id/history`, handlers.history);
}

function accessContext(request) {
  return {
    channel: 'public',
    userAgent: request.headers.get('user-agent') ?? null
  };
}

export function registerDocumentRoutes(router, { service }) {
  registerCrud(router, {
    service,
    path: '/document-templates',
    resource: 'documentTemplates',
    create: (body, actorId) => service.createDocumentTemplate(body, actorId),
    readPermission: 'documents.read',
    writePermission: 'documents.write'
  });
  registerCrud(router, {
    service,
    path: '/documents',
    resource: 'documents',
    create: (body, actorId) => service.registerDocument(body, actorId),
    readPermission: 'documents.read',
    writePermission: 'documents.write'
  });
  registerCrud(router, {
    service,
    path: '/credentials',
    resource: 'credentials',
    create: async (body, actorId) => {
      const credential = await service.issueCredential(body, actorId);
      return { ...credential, verificationToken: credential.verificationToken };
    },
    readPermission: 'credentials.read',
    writePermission: 'credentials.write',
    mutable: false
  });

  router.add('POST', '/documents/versions', async (request) => {
    const body = await parseJson(request);
    const previous = await service.getCrudResource('documents', body.previousDocumentId);
    const identity = authorizeRequest(request, service, {
      organizationId: previous.organizationId,
      permissions: ['documents.write']
    });

    return Response.json(await service.registerDocumentVersion(body.previousDocumentId, body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/documents/:id/transition', async (request, _url, params) => {
    const document = await service.getCrudResource('documents', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: document.organizationId,
      permissions: ['documents.write']
    });
    return Response.json(await service.transitionDocumentStatus(params.id, body, identity.actorId));
  });

  router.add('POST', '/documents/:id/pseudonymize', async (request, _url, params) => {
    const document = await service.getCrudResource('documents', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: document.organizationId,
      permissions: ['documents.write']
    });
    return Response.json(await service.pseudonymizeDocument(params.id, body, identity.actorId));
  });

  router.add('POST', '/credentials/revisions', async (request) => {
    const body = await parseJson(request);
    const previous = await service.getCrudResource('credentials', body.previousCredentialId);
    const identity = authorizeRequest(request, service, {
      organizationId: previous.organizationId,
      permissions: ['credentials.write']
    });
    const credential = await service.issueCredentialRevision(body.previousCredentialId, body, identity.actorId);
    return Response.json({ ...credential, verificationToken: credential.verificationToken }, { status: 201 });
  });

  router.add('POST', '/credentials/:id/transition', async (request, _url, params) => {
    const credential = await service.getCrudResource('credentials', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: credential.organizationId,
      permissions: ['credentials.write']
    });
    return Response.json(await service.transitionCredentialStatus(params.id, body, identity.actorId));
  });

  const shareHandlers = makeCrudHandlers({
    service,
    resource: 'documentShares',
    create: async (body, actorId) => {
      const share = await service.createDocumentShare(body, actorId);
      return { ...share, accessToken: share.accessToken };
    },
    readPermission: 'documents.read',
    writePermission: 'documents.write'
  });
  router.add('POST', '/document-shares', shareHandlers.create);
  router.add('GET', '/document-shares', shareHandlers.list);
  router.add('GET', '/document-shares/:id', shareHandlers.get);
  router.add('GET', '/document-shares/:id/history', shareHandlers.history);
  router.add('POST', '/document-shares/:id/revoke', async (request, _url, params) => {
    const share = await service.getCrudResource('documentShares', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: share.organizationId,
      permissions: ['documents.write']
    });
    return Response.json(await service.revokeDocumentShare(params.id, body, identity.actorId));
  });

  router.add('GET', '/public/document-shares/:token', async (request, _url, params) =>
    Response.json(await service.accessDocumentShare(params.token, accessContext(request)))
  );
  router.add('GET', '/public/credentials/verify/:reference', async (request, _url, params) => {
    const verification = await service.verifyPublicCredential(params.reference, accessContext(request));
    if (!verification) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Credential not found.' } }, { status: 404 });
    }
    return Response.json(verification);
  });

  router.add('POST', '/collaboration/requests', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['collaboration.write']
    });
    return Response.json(await service.createCollaborationRequest(body, identity.actorId), { status: 201 });
  });
  router.add('GET', '/collaboration/requests', async (request, url) => {
    const identity = requireIdentity(request, service);
    const organizationId = url.searchParams.get('organizationId') ?? identity.organizationId;
    authorizeRequest(request, service, { organizationId, permissions: ['collaboration.read'] });
    return Response.json(await service.listCrudResource('collaborationRequests', {
      organizationIds: [organizationId],
      ...parsePagination(url)
    }));
  });
  router.add('GET', '/collaboration/requests/:id', async (request, _url, params) => {
    const collaboration = await service.getCrudResource('collaborationRequests', params.id);
    const identity = requireIdentity(request, service);
    const organizationId = identity.organizationIds.includes(collaboration.destinationOrganizationId)
      ? collaboration.destinationOrganizationId
      : collaboration.sourceOrganizationId;
    authorizeRequest(request, service, { organizationId, permissions: ['collaboration.read'] });
    return Response.json(collaboration);
  });
  router.add('POST', '/collaboration/requests/:id/decision', async (request, _url, params) => {
    const collaboration = await service.getCrudResource('collaborationRequests', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: collaboration.destinationOrganizationId,
      permissions: ['collaboration.write']
    });
    return Response.json(await service.decideCollaborationRequest(params.id, body, identity.actorId));
  });

  router.add('POST', '/transfers', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['transfers.write']
    });
    return Response.json(await service.createTransfer(body, identity.actorId), { status: 201 });
  });
  router.add('GET', '/transfers', async (request, url) => {
    const identity = requireIdentity(request, service);
    const organizationId = url.searchParams.get('organizationId') ?? identity.organizationId;
    authorizeRequest(request, service, { organizationId, permissions: ['transfers.read'] });
    return Response.json(await service.listCrudResource('transfers', {
      organizationIds: [organizationId],
      ...parsePagination(url)
    }));
  });
  router.add('GET', '/transfers/:id', async (request, _url, params) => {
    const transfer = await service.getCrudResource('transfers', params.id);
    const identity = requireIdentity(request, service);
    const organizationId = identity.organizationIds.includes(transfer.destinationOrganizationId)
      ? transfer.destinationOrganizationId
      : transfer.sourceOrganizationId;
    authorizeRequest(request, service, { organizationId, permissions: ['transfers.read'] });
    return Response.json(transfer);
  });
  router.add('POST', '/transfers/:id/transition', async (request, _url, params) => {
    const transfer = await service.getCrudResource('transfers', params.id);
    const body = await parseJson(request);
    const destinationAction = ['acknowledged', 'refused'].includes(body.status);
    const identity = authorizeRequest(request, service, {
      organizationId: destinationAction ? transfer.destinationOrganizationId : transfer.sourceOrganizationId,
      permissions: ['transfers.write']
    });
    return Response.json(await service.transitionTransfer(params.id, body, identity.actorId));
  });
}
