import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { ApiError } from '../../shared/errors.js';
import { makeCrudHandlers } from './_helpers.js';

export function registerI18nRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'localizationProfiles',
    create: (body, actorId) => service.upsertLocalizationProfile(body, actorId),
    readPermission: 'i18n.read',
    writePermission: 'i18n.write'
  });
  router.add('GET', '/i18n/profiles', handlers.list);
  router.add('POST', '/i18n/profiles', handlers.create);

  router.add('GET', '/i18n/profile', async (request, url) => {
    const identity = requireIdentity(request, service);
    const organizationId = url.searchParams.get('organizationId') ?? identity.organizationId;
    if (!organizationId) throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
    authorizeRequest(request, service, { organizationId, permissions: ['i18n.read'] });
    return Response.json(service.localizationProfiles.get(organizationId) ?? null);
  });
  router.add('POST', '/i18n/profile', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['i18n.write'] });
    return Response.json(await service.upsertLocalizationProfile(body, identity.actorId), { status: 201 });
  });
  router.add('POST', '/i18n/format', async (request) => {
    const body = await parseJson(request);
    authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['i18n.read'] });
    return Response.json(service.formatLocalizedValue(body));
  });
}
