import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
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
  const submissionHandlers = makeCrudHandlers({
    service,
    resource: 'assignmentSubmissions',
    create: (body, actorId) => service.submitAssignment(body, actorId),
    readPermission: 'assignments.read',
    writePermission: 'assignments.write'
  });

  router.add('POST', '/assignments/submissions', submissionHandlers.create);
  router.add('GET', '/assignments/submissions', submissionHandlers.list);
  router.add('GET', '/assignments/submissions/:id', submissionHandlers.get);
  router.add('PUT', '/assignments/submissions/:id', submissionHandlers.update);
  router.add('DELETE', '/assignments/submissions/:id', submissionHandlers.remove);
  router.add('GET', '/assignments/submissions/:id/history', submissionHandlers.history);

  router.add('POST', '/assignments/submissions/grade', async (request) => {
    const body = await parseJson(request);
    const submission = service.assignmentSubmissions.get(body.submissionId);
    if (!submission) {
      throw new ValidationError(`Unknown submission: ${body.submissionId}`);
    }
    const identity = authorizeRequest(request, service, { organizationId: submission.organizationId, permissions: ['assignments.write'] });
    return Response.json(await service.gradeSubmission(body.submissionId, body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/assignments/:id/publish', async (request, _url, params) => {
    const assignment = service.assignments.get(params.id);
    if (!assignment) throw new ValidationError(`Unknown assignment: ${params.id}`);
    const identity = authorizeRequest(request, service, {
      organizationId: assignment.organizationId,
      permissions: ['assignments.write'],
      context: { resource: 'assignments', action: 'write', scopeType: 'class', scopeId: assignment.classId }
    });
    return Response.json(await service.publishAssignment(params.id, identity.actorId));
  });

  router.add('GET', '/assignments/visible/me', async (request, url) => {
    const identity = requireIdentity(request, service);
    const organizationId = url.searchParams.get('organizationId') ?? identity.organizationId;
    authorizeRequest(request, service, { organizationId, permissions: ['assignments.read'] });
    const learner = service.getLearnerForAccount(identity.accountId, organizationId);
    return Response.json(service.listVisibleAssignments({ organizationId, learnerId: learner.id }));
  });

  router.add('POST', '/assignments', handlers.create);
  router.add('GET', '/assignments', handlers.list);
  router.add('GET', '/assignments/:id', handlers.get);
  router.add('PUT', '/assignments/:id', handlers.update);
  router.add('DELETE', '/assignments/:id', handlers.remove);
  router.add('GET', '/assignments/:id/history', handlers.history);
}
