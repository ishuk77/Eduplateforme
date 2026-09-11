import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

function getOrganizationIdFromSearch(url) {
  return url.searchParams.get('organizationId') ?? null;
}

export function bootstrapOrAuthorize(request, service, body, permissions = []) {
  if (service.accounts.size === 0) {
    return { actorId: 'bootstrap', accountId: 'bootstrap', organizationIds: [], permissions: ['*'] };
  }

  return authorizeRequest(request, service, {
    organizationId: body?.organizationId ?? null,
    permissions
  });
}

export function makeCrudHandlers({
  service,
  resource,
  create,
  readPermission,
  writePermission,
  getOrganizationIdFromBody = (body) => body.organizationId ?? null,
  listFilters = (url) => ({ organizationId: getOrganizationIdFromSearch(url), ...parsePagination(url) })
}) {
  return {
    create: async (request) => {
      const body = await parseJson(request);
      const identity = authorizeRequest(request, service, {
        organizationId: getOrganizationIdFromBody(body),
        permissions: [writePermission]
      });
      return Response.json(create(body, identity.actorId), { status: 201 });
    },
    list: async (request, url) => {
      const filters = listFilters(url);
      authorizeRequest(request, service, {
        organizationId: filters.organizationId ?? null,
        permissions: [readPermission]
      });
      return Response.json(service.listCrudResource(resource, filters));
    },
    get: async (request, _url, params) => {
      const record = service.getCrudResource(resource, params.id);
      authorizeRequest(request, service, {
        organizationId: record.organizationId ?? null,
        permissions: [readPermission]
      });
      return Response.json(record);
    },
    update: async (request, _url, params) => {
      const existing = service.getCrudResource(resource, params.id);
      const body = await parseJson(request);
      const identity = authorizeRequest(request, service, {
        organizationId: existing.organizationId ?? null,
        permissions: [writePermission]
      });
      return Response.json(service.updateCrudResource(resource, params.id, body, identity.actorId));
    },
    remove: async (request, _url, params) => {
      const existing = service.getCrudResource(resource, params.id);
      const identity = authorizeRequest(request, service, {
        organizationId: existing.organizationId ?? null,
        permissions: [writePermission]
      });
      return Response.json(service.archiveCrudResource(resource, params.id, identity.actorId));
    },
    history: async (request, url, params) => {
      const existing = service.getCrudResource(resource, params.id);
      authorizeRequest(request, service, {
        organizationId: existing.organizationId ?? null,
        permissions: [readPermission]
      });
      return Response.json(service.getCrudHistory(resource, params.id, parsePagination(url)));
    }
  };
}
