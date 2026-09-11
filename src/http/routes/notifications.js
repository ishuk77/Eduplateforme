import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerNotificationRoutes(router, { service }) {
  router.add('POST', '/notifications', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createNotification(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/notifications/sent', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.markNotificationSent(body.notificationId, requireActor(request)), { status: 200 });
  });
}
