import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest, enforceRateLimit, requireIdentity } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';
import { ASSET_LIMITS } from '../../services/secure-assets-service.js';
import { binaryResponse, parseAssetRequest } from './_uploads.js';
import { ApiError } from '../../shared/errors.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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
  router.add('GET', '/public/organizations/:id/logo', async (_request, _url, params) => {
    const branding = service.getTenantLogo(params.id);
    if (!branding) return Response.json({ error: { code: 'NOT_FOUND', message: 'Logo not found.' } }, { status: 404 });
    return binaryResponse(await service.getTenantLogoContent(params.id), { fileName: branding.fileName });
  });

  router.add('GET', '/organizations/:id/branding', async (request, _url, params) => {
    authorizeRequest(request, service, { organizationId: params.id, permissions: ['organizations.read'] });
    return Response.json(service.getTenantLogo(params.id));
  });

  router.add('POST', '/organizations/:id/branding/logo', async (request, _url, params) => {
    enforceRateLimit(request, { namespace: 'logo-upload', limit: 20 });
    const identity = authorizeRequest(request, service, {
      organizationId: params.id,
      permissions: ['organizations.write']
    });
    const body = await parseAssetRequest(request, ASSET_LIMITS.logo);
    return Response.json(await service.saveTenantLogo({ ...body, organizationId: params.id }, identity.actorId), { status: 201 });
  });

  router.add('DELETE', '/organizations/:id/branding/logo', async (request, _url, params) => {
    const identity = authorizeRequest(request, service, {
      organizationId: params.id,
      permissions: ['organizations.write']
    });
    return Response.json({ removed: await service.removeTenantLogo(params.id, identity.actorId) });
  });

  router.add('GET', '/signatures', async (request, url) => {
    const identity = requireIdentity(request, service);
    const organizationId = url.searchParams.get('organizationId') ?? identity.organizationId;
    authorizeRequest(request, service, { organizationId, permissions: ['credentials.read'] });
    return Response.json({ items: service.listManagedSignatures(organizationId, url.searchParams.get('personId')) });
  });

  router.add('POST', '/signatures', async (request) => {
    enforceRateLimit(request, { namespace: 'signature-upload', limit: 30 });
    requireIdentity(request, service);
    const body = await parseAssetRequest(request, ASSET_LIMITS.signature);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['credentials.write']
    });
    return Response.json(await service.createManagedSignature(body, identity.actorId), { status: 201 });
  });

  router.add('GET', '/signatures/:id/content', async (request, _url, params) => {
    const signature = await service.getCrudResource('managedSignatures', params.id);
    authorizeRequest(request, service, { organizationId: signature.organizationId, permissions: ['credentials.read'] });
    return binaryResponse(await service.getManagedSignatureContent(params.id, signature.organizationId), {
      fileName: signature.fileName
    });
  });

  router.add('POST', '/signatures/:id/revoke', async (request, _url, params) => {
    const signature = await service.getCrudResource('managedSignatures', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: signature.organizationId,
      permissions: ['credentials.write']
    });
    return Response.json(await service.revokeManagedSignature(params.id, signature.organizationId, await parseJson(request), identity.actorId));
  });

  router.add('POST', '/documents/evidence', async (request) => {
    enforceRateLimit(request, { namespace: 'evidence-upload', limit: 40 });
    requireIdentity(request, service);
    const body = await parseAssetRequest(request, ASSET_LIMITS.evidence);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['documents.write']
    });
    return Response.json(await service.uploadEvidenceDocument(body, identity.actorId), { status: 201 });
  });

  router.add('GET', '/documents/:id/content', async (request, _url, params) => {
    const document = await service.getCrudResource('documents', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: document.organizationId,
      permissions: ['documents.read']
    });
    const accountPersonId = service.accounts.get(identity.accountId)?.personId;
    if (document.accessLevel === 'holder' && accountPersonId !== document.personId
      && !identity.permissions.includes('*') && !identity.permissions.includes('documents.write')) {
      throw new ApiError('FORBIDDEN', 'Holder documents are only available to their holder or an authorized records officer.', 403);
    }
    return binaryResponse(await service.getEvidenceContent(params.id, document.organizationId), {
      disposition: 'attachment',
      fileName: document.metadata.fileName
    });
  });

  router.add('GET', '/credentials/:id/print', async (request, _url, params) => {
    const credential = await service.getCrudResource('credentials', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: credential.organizationId,
      permissions: ['credentials.read']
    });
    const accountPersonId = service.accounts.get(identity.accountId)?.personId;
    if (accountPersonId !== credential.personId
      && !identity.permissions.includes('*') && !identity.permissions.includes('credentials.write')) {
      throw new ApiError('FORBIDDEN', 'This title is only available to its holder or an authorized issuer.', 403);
    }
    const document = await service.getCrudResource('documents', credential.documentId);
    const snapshot = document.metadata?.generatedSnapshot ?? {};
    return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(credential.credentialNumber)}</title><link rel="stylesheet" href="${new URL('/styles.css', request.url)}"></head><body class="print-title"><p>Eduplateforme</p><h1>${escapeHtml(credential.qualification)}</h1><p>attribué à</p><h2>${escapeHtml(snapshot.holder?.name)}</h2><dl><div><dt>Programme</dt><dd>${escapeHtml(snapshot.program?.title)}</dd></div><div><dt>Numéro</dt><dd>${escapeHtml(credential.credentialNumber)}</dd></div><div><dt>Date</dt><dd>${escapeHtml(credential.awardedAt)}</dd></div><div><dt>Statut</dt><dd>${escapeHtml(credential.status)}</dd></div></dl><section>${credential.signatories.map((signatory) => `<p><strong>${escapeHtml(signatory.name)}</strong><br>${escapeHtml(signatory.function)}<br><small>${escapeHtml(signatory.evidenceReference)}</small></p>`).join('')}</section><small>${escapeHtml(snapshot.assurance)} · Vérification publique: ${escapeHtml(credential.publicReference)}</small></body></html>`, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'self'",
        'cache-control': 'private, no-store'
      }
    });
  });

  router.add('POST', '/documents/:id/verification', async (request, _url, params) => {
    const document = await service.getCrudResource('documents', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: document.organizationId,
      permissions: ['documents.verify']
    });
    return Response.json(await service.verifyEvidenceDocument(
      params.id,
      document.organizationId,
      await parseJson(request),
      identity.actorId
    ));
  });

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
