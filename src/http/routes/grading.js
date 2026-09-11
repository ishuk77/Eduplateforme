import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';
import { ApiError } from '../../shared/errors.js';

export function registerGradingRoutes(router, { service }) {
  const gradeHandlers = makeCrudHandlers({
    service,
    resource: 'grades',
    create: (body, actorId) => service.recordGrade(body, actorId),
    readPermission: 'grading.read',
    writePermission: 'grading.write',
    listFilters: (url) => ({
      organizationId: url.searchParams.get('organizationId') ?? null,
      learnerId: url.searchParams.get('learnerId') ?? undefined,
      ...parsePagination(url)
    })
  });

  router.add('POST', '/grading/systems', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['grading.write'] });
    return Response.json(await service.configureGradingSystem(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/grading/grades', gradeHandlers.create);
  router.add('GET', '/grading/grades', gradeHandlers.list);
  router.add('GET', '/grading/grades/:id', gradeHandlers.get);
  router.add('PUT', '/grading/grades/:id', gradeHandlers.update);
  router.add('DELETE', '/grading/grades/:id', gradeHandlers.remove);
  router.add('GET', '/grading/grades/:id/history', gradeHandlers.history);

  router.add('GET', '/grading/average', async (request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    const learnerId = url.searchParams.get('learnerId');
    if (!organizationId) {
      throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
    }
    if (!learnerId) {
      throw new ApiError('INVALID_INPUT', 'learnerId is required.', 400);
    }
    authorizeRequest(request, service, { organizationId, permissions: ['grading.read'] });
    return Response.json(service.calculateLearnerAverage({
      organizationId,
      learnerId
    }));
  });
}
