import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerAcademicRoutes(router, { service }) {
  router.add('POST', '/academics/learners', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createLearner(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/academics/years', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createAcademicYear(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/academics/programs', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createProgram(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/academics/classes', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createClass(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/academics/enrollments', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createEnrollment(body, requireActor(request)), { status: 201 });
  });
}
