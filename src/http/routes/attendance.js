import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';
import { ApiError } from '../../shared/errors.js';

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
    const learnerId = url.searchParams.get('learnerId');
    if (!organizationId) {
      throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
    }
    if (!learnerId) {
      throw new ApiError('INVALID_INPUT', 'learnerId is required.', 400);
    }
    authorizeRequest(request, service, { organizationId, permissions: ['attendance.read'] });
    return Response.json(service.getAttendanceRate({
      organizationId,
      learnerId
    }));
  });
}
