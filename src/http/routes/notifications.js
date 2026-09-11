import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { ValidationError } from '../../shared/entity.js';

export function registerNotificationRoutes(router, { service }) {
  router.add('POST', '/notifications', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['notifications.write'] });
    return Response.json(service.createNotification(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/notifications/sent', async (request) => {
    const body = await parseJson(request);
    const notification = service.notifications.get(body.notificationId);
    if (!notification) {
      throw new ValidationError(`Unknown notification: ${body.notificationId}`);
    }
    const identity = authorizeRequest(request, service, { organizationId: notification.organizationId, permissions: ['notifications.write'] });
    return Response.json(service.markNotificationSent(body.notificationId, identity.actorId), { status: 200 });
  });
}
