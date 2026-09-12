import { parsePagination } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';
import { ApiError } from '../../shared/errors.js';

export function registerGradingRoutes(router, { service }) {
  const systemHandlers = makeCrudHandlers({
    service,
    resource: 'gradingSystems',
    create: (body, actorId) => service.configureGradingSystem(body, actorId),
    readPermission: 'grading.read',
    writePermission: 'grading.write'
  });
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

  router.add('POST', '/grading/systems', systemHandlers.create);
  router.add('GET', '/grading/systems', systemHandlers.list);
  router.add('GET', '/grading/systems/:id', systemHandlers.get);
  router.add('PUT', '/grading/systems/:id', systemHandlers.update);
  router.add('DELETE', '/grading/systems/:id', systemHandlers.remove);
  router.add('GET', '/grading/systems/:id/history', systemHandlers.history);

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

  router.add('GET', '/grading/me', async (request, url) => {
    const identity = requireIdentity(request, service);
    const organizationId = url.searchParams.get('organizationId') ?? identity.organizationId;
    const permissions = service.getAccountPermissions(identity.accountId, organizationId);
    if (!permissions.includes('*') && !permissions.includes('grading.read') && !permissions.includes('grading.self')) {
      throw new ApiError('FORBIDDEN', 'Missing permission: grading.self', 403);
    }
    const learner = service.getLearnerForAccount(identity.accountId, organizationId);
    return Response.json(service.getLearnerGradebook({ organizationId, learnerId: learner.id }));
  });
}
