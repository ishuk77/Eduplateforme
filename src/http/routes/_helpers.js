import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { ApiError } from '../../shared/errors.js';

function getOrganizationIdFromSearch(url) {
  return url.searchParams.get('organizationId') ?? null;
}

function parseIncludeArchived(url) {
  const value = url.searchParams.get('includeArchived');
  return value === 'true' || value === '1';
}

export function bootstrapOrAuthorize(request, service, body, permissions = []) {
  if (service.accounts.size === 0) {
    return { actorId: 'bootstrap', accountId: 'bootstrap', organizationIds: [], permissions: ['*'] };
  }

  const organizationId = body?.organizationId
    ?? body?.primaryOrganizationId
    ?? body?.organizationIds?.[0]
    ?? null;

  return authorizeRequest(request, service, {
    organizationId,
    permissions
  });
}

export function makeCrudHandlers({
  service,
  resource,
  create,
  readPermission,
  writePermission,
  contextualResource = null,
  getOrganizationIdFromBody = (body) => body.organizationId ?? null,
  getOrganizationIdFromRecord = (record) => record.organizationId ?? null,
  listFilters = (url) => ({ organizationId: getOrganizationIdFromSearch(url), ...parsePagination(url) })
}) {
  return {
    create: async (request) => {
      const body = await parseJson(request);
      const identity = authorizeRequest(request, service, {
        organizationId: getOrganizationIdFromBody(body),
        permissions: [writePermission],
        context: contextualResource ? {
          resource: contextualResource,
          action: 'write',
          scopeType: body.classId ? 'class' : body.programId ? 'program' : body.campusId ? 'site' : body.learnerId ? 'learner' : 'organization',
          scopeId: body.classId ?? body.programId ?? body.campusId ?? body.learnerId ?? null
        } : null
      });
      return Response.json(await create(body, identity.actorId), { status: 201 });
    },
    list: async (request, url) => {
      const filters = listFilters(url);
      const identity = requireIdentity(request, service);
      if (!filters.organizationId) {
        if (identity.organizationId) {
          filters.organizationId = identity.organizationId;
        } else if ((identity.organizationIds?.length ?? 0) === 1) {
          [filters.organizationId] = identity.organizationIds;
        } else if ((identity.organizationIds?.length ?? 0) > 1) {
          throw new ApiError('INVALID_INPUT', 'organizationId is required for multi-organization accounts.', 400);
        }
      } else if (!identity.organizationIds.includes(filters.organizationId)) {
        throw new ApiError('FORBIDDEN', 'Cross-organization access is forbidden.', 403);
      }
      authorizeRequest(request, service, {
        organizationId: filters.organizationId,
        permissions: [readPermission]
      });
      filters.includeArchived = parseIncludeArchived(url);
      await service.recordSensitiveAccess?.({
        actorId: identity.actorId,
        organizationId: filters.organizationId,
        resource,
        context: { operation: 'list', filters }
      });
      return Response.json(await service.listCrudResource(resource, filters));
    },
    get: async (request, _url, params) => {
      const record = await service.getCrudResource(resource, params.id);
      const identity = authorizeRequest(request, service, {
        organizationId: getOrganizationIdFromRecord(record),
        permissions: [readPermission],
        context: contextualResource ? {
          resource: contextualResource,
          action: 'read',
          scopeType: record.classId ? 'class' : record.programId ? 'program' : record.campusId ? 'site' : record.learnerId ? 'learner' : 'organization',
          scopeId: record.classId ?? record.programId ?? record.campusId ?? record.learnerId ?? null
        } : null
      });
      await service.recordSensitiveAccess?.({
        actorId: identity.actorId,
        organizationId: getOrganizationIdFromRecord(record),
        resource,
        entityId: params.id,
        context: { operation: 'read' }
      });
      return Response.json(record);
    },
    update: async (request, _url, params) => {
      const existing = await service.getCrudResource(resource, params.id);
      const body = await parseJson(request);
      const identity = authorizeRequest(request, service, {
        organizationId: getOrganizationIdFromRecord(existing),
        permissions: [writePermission],
        context: contextualResource ? {
          resource: contextualResource,
          action: 'write',
          scopeType: existing.classId ? 'class' : existing.programId ? 'program' : existing.campusId ? 'site' : existing.learnerId ? 'learner' : 'organization',
          scopeId: existing.classId ?? existing.programId ?? existing.campusId ?? existing.learnerId ?? null
        } : null
      });
      return Response.json(await service.updateCrudResource(resource, params.id, body, identity.actorId));
    },
    remove: async (request, _url, params) => {
      const existing = await service.getCrudResource(resource, params.id);
      const identity = authorizeRequest(request, service, {
        organizationId: getOrganizationIdFromRecord(existing),
        permissions: [writePermission],
        context: contextualResource ? {
          resource: contextualResource,
          action: 'write',
          scopeType: existing.classId ? 'class' : existing.programId ? 'program' : existing.campusId ? 'site' : existing.learnerId ? 'learner' : 'organization',
          scopeId: existing.classId ?? existing.programId ?? existing.campusId ?? existing.learnerId ?? null
        } : null
      });
      return Response.json(await service.archiveCrudResource(resource, params.id, identity.actorId));
    },
    history: async (request, url, params) => {
      const existing = await service.getCrudResource(resource, params.id);
      authorizeRequest(request, service, {
        organizationId: getOrganizationIdFromRecord(existing),
        permissions: [readPermission]
      });
      return Response.json(await service.getCrudHistory(resource, params.id, parsePagination(url)));
    }
  };
}
