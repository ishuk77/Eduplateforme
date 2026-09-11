import { parseJson, parsePagination } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerGradingRoutes(router, { service }) {
  router.add('POST', '/grading/systems', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.configureGradingSystem(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/grading/grades', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.recordGrade(body, requireActor(request)), { status: 201 });
  });

  router.add('GET', '/grading/grades', async (_request, url) => {
    const organizationId = url.searchParams.get('organizationId');
    const learnerId = url.searchParams.get('learnerId');
    return Response.json(service.listGrades({ organizationId, learnerId, ...parsePagination(url) }));
  });

  router.add('GET', '/grading/average', async (_request, url) => {
    return Response.json(service.calculateLearnerAverage({
      organizationId: url.searchParams.get('organizationId'),
      learnerId: url.searchParams.get('learnerId')
    }));
  });
}
