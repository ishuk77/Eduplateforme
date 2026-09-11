import { parseJson, parsePagination } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';
import { makeCrudHandlers } from './_helpers.js';

function registerCrud(router, {
  service,
  path,
  resource,
  create,
  readPermission,
  writePermission,
  contextualResource = readPermission.split('.')[0],
  listFilters,
  appendOnly = false
}) {
  const handlers = makeCrudHandlers({
    service,
    resource,
    create,
    readPermission,
    writePermission,
    contextualResource,
    listFilters: listFilters ?? ((url) => ({
      organizationId: url.searchParams.get('organizationId') ?? null,
      ...parsePagination(url)
    }))
  });
  router.add('POST', path, handlers.create);
  router.add('GET', path, handlers.list);
  router.add('GET', `${path}/:id`, handlers.get);
  if (!appendOnly) {
    router.add('PUT', `${path}/:id`, handlers.update);
    router.add('DELETE', `${path}/:id`, handlers.remove);
  }
  router.add('GET', `${path}/:id/history`, handlers.history);
}

export function registerInstitutionalRoutes(router, { service }) {
  const resources = [
    ['/institution/campuses', 'campuses', 'createCampus', 'institution.read', 'institution.write'],
    ['/institution/operating-authorizations', 'operatingAuthorizations', 'createOperatingAuthorization', 'institution.read', 'institution.write'],
    ['/institution/accreditations', 'accreditations', 'createAccreditation', 'institution.read', 'institution.write'],
    ['/institution/verifications', 'institutionVerifications', 'createInstitutionVerification', 'institution.read', 'institution.verify'],
    ['/profiles/guardians', 'guardianProfiles', 'createGuardianProfile', 'profiles.read', 'profiles.write'],
    ['/profiles/professionals', 'professionalProfiles', 'createProfessionalProfile', 'profiles.read', 'profiles.write'],
    ['/profiles/guardian-relations', 'guardianLearnerRelations', 'createGuardianLearnerRelation', 'profiles.read', 'profiles.write'],
    ['/profiles/professional-assignments', 'professionalAssignments', 'createProfessionalAssignment', 'profiles.read', 'profiles.write'],
    ['/academics/periods', 'academicPeriods', 'createAcademicPeriod', 'academics.read', 'academics.write'],
    ['/academics/levels', 'academicLevels', 'createAcademicLevel', 'academics.read', 'academics.write'],
    ['/academics/subjects', 'subjects', 'createSubject', 'academics.read', 'academics.write'],
    ['/academics/courses', 'courses', 'createCourse', 'academics.read', 'academics.write'],
    ['/academics/lifecycle-events', 'learnerLifecycleEvents', 'recordLearnerLifecycleEvent', 'lifecycle.read', 'lifecycle.write'],
    ['/security/contextual-permissions', 'contextualPermissionRules', 'createContextualPermissionRule', 'authorization-matrix.read', 'authorization-matrix.write']
  ];

  for (const [path, resource, method, readPermission, writePermission] of resources) {
    registerCrud(router, {
      service,
      path,
      resource,
      create: (body, actorId) => service[method](body, actorId),
      readPermission,
      writePermission,
      appendOnly: resource === 'learnerLifecycleEvents'
    });
  }

  const transition = (resource, permission) => async (request, _url, params) => {
    const record = await service.getCrudResource(resource, params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: record.organizationId,
      permissions: [permission]
    });
    return Response.json(await service.transitionInstitutionalStatus(resource, params.id, body, identity.actorId));
  };

  router.add('POST', '/institution/operating-authorizations/:id/transition', transition('operatingAuthorizations', 'institution.write'));
  router.add('POST', '/institution/accreditations/:id/transition', transition('accreditations', 'institution.write'));
  router.add('POST', '/institution/verifications/:id/transition', transition('institutionVerifications', 'institution.verify'));

  router.add('POST', '/profiles/guardian-relations/:id/withdraw', async (request, _url, params) => {
    const record = await service.getCrudResource('guardianLearnerRelations', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: record.organizationId,
      permissions: ['profiles.write']
    });
    return Response.json(await service.withdrawGuardianLearnerRelation(params.id, body, identity.actorId));
  });

  router.add('GET', '/public/institutions/verify/:code', async (_request, _url, params) => {
    const verification = service.getPublicInstitutionVerification(params.code);
    if (!verification) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Verification not found.' } }, { status: 404 });
    }
    return Response.json(verification);
  });
}
