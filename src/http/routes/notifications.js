import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { ValidationError } from '../../shared/entity.js';
import { makeCrudHandlers } from './_helpers.js';

export function registerNotificationRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'notifications',
    create: (body, actorId) => service.createNotification(body, actorId),
    readPermission: 'notifications.read',
    writePermission: 'notifications.write'
  });
  router.add('POST', '/notifications', handlers.create);
  router.add('GET', '/notifications', handlers.list);
  router.add('GET', '/notifications/:id', handlers.get);
  router.add('PUT', '/notifications/:id', handlers.update);
  router.add('DELETE', '/notifications/:id', handlers.remove);
  router.add('GET', '/notifications/:id/history', handlers.history);

  router.add('POST', '/notifications/sent', async (request) => {
    const body = await parseJson(request);
    const notification = service.notifications.get(body.notificationId);
    if (!notification) {
      throw new ValidationError(`Unknown notification: ${body.notificationId}`);
    }
    const identity = authorizeRequest(request, service, { organizationId: notification.organizationId, permissions: ['notifications.write'] });
    return Response.json(await service.markNotificationSent(body.notificationId, identity.actorId), { status: 200 });
  });
}
