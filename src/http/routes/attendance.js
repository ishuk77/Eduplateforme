import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';

export function registerAttendanceRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'attendance',
    create: (body, actorId) => service.recordAttendance(body, actorId),
    readPermission: 'attendance.read',
    writePermission: 'attendance.write'
  });

  router.add('POST', '/attendance/records', handlers.create);
  router.add('GET', '/attendance/records', handlers.list);
  router.add('GET', '/attendance/records/:id', handlers.get);
  router.add('PUT', '/attendance/records/:id', handlers.update);
  router.add('DELETE', '/attendance/records/:id', handlers.remove);
  router.add('GET', '/attendance/records/:id/history', handlers.history);

  router.add('GET', '/attendance/rate', async (request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    authorizeRequest(request, service, { organizationId, permissions: ['attendance.read'] });
    return Response.json(service.getAttendanceRate({
      organizationId,
      learnerId: url.searchParams.get('learnerId')
    }));
  });
}
