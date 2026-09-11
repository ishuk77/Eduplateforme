import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerSubscriptionRoutes(router, { service }) {
  router.add('POST', '/subscriptions/platform', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createPlatformSubscription(body, requireActor(request)), { status: 201 });
  });
}
