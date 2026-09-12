import { authorizeRequest, enforceRateLimit, requireIdentity } from '../middleware/auth.js';
import { parseJson } from '../middleware/validation.js';
import { ApiError } from '../../shared/errors.js';
import { createImportTemplate, IMPORT_LIMITS, IMPORT_SCHEMAS } from '../../services/bulk-import-service.js';

function resolveOrganizationId(request, service, candidate = null) {
  const identity = requireIdentity(request, service);
  const organizationId = candidate ?? identity.organizationId
    ?? (identity.organizationIds.length === 1 ? identity.organizationIds[0] : null);
  if (!organizationId) throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
  return { identity, organizationId };
}

function assertImportRequestSize(request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > Math.ceil(IMPORT_LIMITS.maxFileBytes * 1.4) + 16_384) {
    throw new ApiError('PAYLOAD_TOO_LARGE', 'Import request exceeds the allowed file size.', 413);
  }
}

function importPermissions(kind) {
  if (kind === 'references') return ['references.write'];
  return kind === 'staff' || kind === 'people'
    ? ['academics.write', 'people.write', 'profiles.write', 'accounts.write']
    : ['academics.write', 'people.write', 'accounts.write'];
}

export function registerImportRoutes(router, { service }) {
  router.add('GET', '/imports/schema', async (request, url) => {
    const { organizationId } = resolveOrganizationId(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['academics.read'] });
    return Response.json({ schemas: IMPORT_SCHEMAS, limits: IMPORT_LIMITS, acceptedTypes: ['.csv', '.xlsx'] });
  });

  router.add('GET', '/imports/templates/:kind', async (request, _url, params) => {
    const { organizationId } = resolveOrganizationId(request, service);
    authorizeRequest(request, service, { organizationId, permissions: ['academics.read'] });
    const body = createImportTemplate(params.kind);
    return new Response(body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${params.kind}-import-template.csv"`
      }
    });
  });

  router.add('POST', '/imports/preview', async (request) => {
    enforceRateLimit(request, { namespace: 'bulk-import-preview', limit: 20, windowMs: 60_000 });
    assertImportRequestSize(request);
    const body = await parseJson(request);
    const { identity, organizationId } = resolveOrganizationId(request, service, body.organizationId);
    authorizeRequest(request, service, { organizationId, permissions: importPermissions(body.kind) });
    return Response.json(await service.executeBulkImport({
      ...body,
      organizationId,
      dryRun: true
    }, identity.actorId));
  });

  router.add('POST', '/imports/apply', async (request) => {
    enforceRateLimit(request, { namespace: 'bulk-import-apply', limit: 10, windowMs: 60_000 });
    assertImportRequestSize(request);
    const body = await parseJson(request);
    const { identity, organizationId } = resolveOrganizationId(request, service, body.organizationId);
    authorizeRequest(request, service, { organizationId, permissions: importPermissions(body.kind) });
    return Response.json(await service.executeBulkImport({
      ...body,
      organizationId,
      dryRun: false
    }, identity.actorId), { status: 201 });
  });
}
