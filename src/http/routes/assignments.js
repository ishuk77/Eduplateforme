import { parseJson } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';
import { ValidationError } from '../../shared/entity.js';

export function registerAssignmentRoutes(router, { service }) {
  const handlers = makeCrudHandlers({
    service,
    resource: 'assignments',
    create: (body, actorId) => service.createAssignment(body, actorId),
    readPermission: 'assignments.read',
    writePermission: 'assignments.write'
  });

  router.add('POST', '/assignments', handlers.create);
  router.add('GET', '/assignments', handlers.list);
  router.add('GET', '/assignments/:id', handlers.get);
  router.add('PUT', '/assignments/:id', handlers.update);
  router.add('DELETE', '/assignments/:id', handlers.remove);
  router.add('GET', '/assignments/:id/history', handlers.history);

  router.add('POST', '/assignments/submissions', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, { organizationId: body.organizationId, permissions: ['assignments.write'] });
    return Response.json(await service.submitAssignment(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/assignments/submissions/grade', async (request) => {
    const body = await parseJson(request);
    const submission = service.assignmentSubmissions.get(body.submissionId);
    if (!submission) {
      throw new ValidationError(`Unknown submission: ${body.submissionId}`);
    }
    const identity = authorizeRequest(request, service, { organizationId: submission.organizationId, permissions: ['assignments.write'] });
    return Response.json(await service.gradeSubmission(body.submissionId, body, identity.actorId), { status: 201 });
  });
}
