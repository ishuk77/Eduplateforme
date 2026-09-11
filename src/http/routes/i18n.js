import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

export function registerI18nRoutes(router, { service }) {
  router.add('POST', '/i18n/profile', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['i18n.write'] });
    return Response.json(service.upsertLocalizationProfile(body, identity.actorId), { status: 201 });
  });
}
