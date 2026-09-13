import { authorizeRequest, enforceRateLimit, requireIdentity } from '../middleware/auth.js';
import { parseJson } from '../middleware/validation.js';
import { ApiError } from '../../shared/errors.js';
import { createImportTemplate, IMPORT_LIMITS, IMPORT_SCHEMAS } from '../../services/bulk-import-service.js';
import {
  createCsvTemplate,
  createXlsxPack,
  createXlsxTemplate,
  IMPORT_CONTRACTS,
  publicImportCatalog,
  TEMPLATE_LIMITS
} from '../../services/import-template-library.js';

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
  if (kind === 'people') return ['academics.write', 'people.write', 'profiles.write', 'accounts.write'];
  if (kind === 'learners') return ['academics.write', 'people.write', 'accounts.write'];
  if (IMPORT_CONTRACTS[kind]) return [IMPORT_CONTRACTS[kind].permission];
  if (kind === 'references') return ['references.write'];
  return ['staff', 'people', 'guardians', 'guardian-learner-relations', 'professionals', 'professional-assignments'].includes(kind)
    ? ['academics.write', 'people.write', 'profiles.write', 'accounts.write']
    : ['academics.write'];
}

export function registerImportRoutes(router, { service }) {
  router.add('GET', '/imports/schema', async (request, url) => {
    const { organizationId } = resolveOrganizationId(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['academics.read'] });
    const catalog = publicImportCatalog();
    return Response.json({
      schemas: IMPORT_SCHEMAS,
      catalog,
      contracts: catalog,
      limits: TEMPLATE_LIMITS,
      acceptedTypes: ['.csv', '.xlsx'],
      ordering: Object.keys(IMPORT_CONTRACTS)
    });
  });

  router.add('GET', '/imports/templates/:kind', async (request, url, params) => {
    const { organizationId } = resolveOrganizationId(request, service);
    const readPermission = IMPORT_CONTRACTS[params.kind]?.permission?.replace(/\.write$/, '.read') ?? 'academics.read';
    authorizeRequest(request, service, { organizationId, permissions: [readPermission] });
    const requestedFormat = url.searchParams.get('format');
    // No format preserves the historical CSV response, including the legacy learners columns.
    let template;
    if (!requestedFormat && IMPORT_SCHEMAS[params.kind]) {
      template = { body: createImportTemplate(params.kind), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
    } else if (!requestedFormat || requestedFormat === 'csv') {
      template = { body: createCsvTemplate(params.kind), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
    } else if (requestedFormat === 'xlsx') {
      template = { body: await createXlsxTemplate(params.kind), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
    } else {
      throw new ApiError('INVALID_INPUT', 'format must be csv or xlsx.', 400);
    }
    return new Response(template.body, {
      headers: {
        'content-type': template.contentType,
        'content-disposition': `attachment; filename="${params.kind}-import-template.${template.extension}"`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store'
      }
    });
  });

  router.add('GET', '/imports/templates-pack.xlsx', async (request) => {
    const { organizationId } = resolveOrganizationId(request, service);
    authorizeRequest(request, service, { organizationId, permissions: ['academics.read'] });
    return new Response(await createXlsxPack(), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename="eduplateforme-import-templates.xlsx"',
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store'
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
