import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';

export function registerAcademicRoutes(router, { service }) {
  const createWithAcademicWrite = (createResource, organizationField = 'organizationId') =>
    async (request) => {
      const body = await parseJson(request);
      const identity = authorizeRequest(request, service, {
        organizationId: body[organizationField] ?? null,
        permissions: ['academics.write']
      });
      return Response.json(createResource(body, identity.actorId), { status: 201 });
    };

  const yearsHandlers = makeCrudHandlers({
    service,
    resource: 'academicYears',
    create: (body, actorId) => service.createAcademicYear(body, actorId),
    readPermission: 'academics.read',
    writePermission: 'academics.write'
  });

  const programsHandlers = makeCrudHandlers({
    service,
    resource: 'programs',
    create: (body, actorId) => service.createProgram(body, actorId),
    readPermission: 'academics.read',
    writePermission: 'academics.write'
  });

  const classesHandlers = makeCrudHandlers({
    service,
    resource: 'classes',
    create: (body, actorId) => service.createClass(body, actorId),
    readPermission: 'academics.read',
    writePermission: 'academics.write'
  });

  const enrollmentsHandlers = makeCrudHandlers({
    service,
    resource: 'enrollments',
    create: (body, actorId) => service.createEnrollment(body, actorId),
    readPermission: 'academics.read',
    writePermission: 'academics.write',
    listFilters: (url) => ({
      organizationId: url.searchParams.get('organizationId') ?? null,
      learnerId: url.searchParams.get('learnerId') ?? undefined,
      classId: url.searchParams.get('classId') ?? undefined,
      ...parsePagination(url)
    })
  });

  router.add('POST', '/academics/learners', createWithAcademicWrite((body, actorId) => service.createLearner(body, actorId)));

  router.add('POST', '/academics/years', yearsHandlers.create);
  router.add('GET', '/academics/years', yearsHandlers.list);
  router.add('GET', '/academics/years/:id', yearsHandlers.get);
  router.add('PUT', '/academics/years/:id', yearsHandlers.update);
  router.add('DELETE', '/academics/years/:id', yearsHandlers.remove);
  router.add('GET', '/academics/years/:id/history', yearsHandlers.history);

  router.add('POST', '/academics/programs', programsHandlers.create);
  router.add('GET', '/academics/programs', programsHandlers.list);
  router.add('GET', '/academics/programs/:id', programsHandlers.get);
  router.add('PUT', '/academics/programs/:id', programsHandlers.update);
  router.add('DELETE', '/academics/programs/:id', programsHandlers.remove);
  router.add('GET', '/academics/programs/:id/history', programsHandlers.history);

  router.add('POST', '/academics/classes', classesHandlers.create);
  router.add('GET', '/academics/classes', classesHandlers.list);
  router.add('GET', '/academics/classes/:id', classesHandlers.get);
  router.add('PUT', '/academics/classes/:id', classesHandlers.update);
  router.add('DELETE', '/academics/classes/:id', classesHandlers.remove);
  router.add('GET', '/academics/classes/:id/history', classesHandlers.history);

  router.add('POST', '/academics/enrollments', enrollmentsHandlers.create);
  router.add('GET', '/academics/enrollments', enrollmentsHandlers.list);
  router.add('GET', '/academics/enrollments/:id', enrollmentsHandlers.get);
  router.add('PUT', '/academics/enrollments/:id', enrollmentsHandlers.update);
  router.add('DELETE', '/academics/enrollments/:id', enrollmentsHandlers.remove);
  router.add('GET', '/academics/enrollments/:id/history', enrollmentsHandlers.history);
}
