import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerAssignmentRoutes(router, { service }) {
  router.add('POST', '/assignments', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createAssignment(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/assignments/submissions', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.submitAssignment(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/assignments/submissions/grade', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.gradeSubmission(body.submissionId, body, requireActor(request)), { status: 201 });
  });
}
