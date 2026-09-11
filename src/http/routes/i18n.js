import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerI18nRoutes(router, { service }) {
  router.add('POST', '/i18n/profile', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.upsertLocalizationProfile(body, requireActor(request)), { status: 201 });
  });
}
