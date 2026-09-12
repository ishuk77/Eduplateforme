import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { parseJson, parsePagination } from '../middleware/validation.js';
import { ApiError } from '../../shared/errors.js';
import { makeCrudHandlers } from './_helpers.js';

const RESOURCE_ROUTES = Object.freeze([
  ['/lms/catalogs', 'lmsCatalogs', 'lms'],
  ['/lms/programs', 'lmsPrograms', 'lms'],
  ['/lms/courses', 'lmsCourses', 'lms'],
  ['/lms/modules', 'lmsModules', 'lms'],
  ['/lms/lessons', 'lmsLessons', 'lms'],
  ['/lms/resources', 'lmsResources', 'lms'],
  ['/lms/participants', 'lmsParticipants', 'lms'],
  ['/lms/enrollments', 'lmsEnrollments', 'lms'],
  ['/lms/progress', 'lmsProgress', 'lms'],
  ['/lms/quizzes', 'lmsQuizzes', 'lms'],
  ['/lms/questions', 'lmsQuestions', 'lms'],
  ['/lms/attempts', 'lmsAttempts', 'lms'],
  ['/lms/assessments', 'lmsAssessments', 'lms'],
  ['/lms/payments', 'lmsPayments', 'lms'],
  ['/lms/certificates', 'lmsCertificates', 'lms'],
  ['/meetings/providers', 'meetingProviders', 'meetings'],
  ['/meetings/participants', 'meetingParticipants', 'meetings'],
  ['/meetings/attendance', 'meetingAttendance', 'meetings'],
  ['/meetings', 'meetings', 'meetings'],
  ['/data-quality/rules', 'dataQualityRules', 'data-quality'],
  ['/data-quality/runs', 'dataQualityRuns', 'data-quality'],
  ['/data-quality/issues', 'dataQualityIssues', 'data-quality'],
  ['/emis/profiles', 'emisProfiles', 'emis'],
  ['/emis/mappings', 'emisMappings', 'emis'],
  ['/emis/national-references', 'emisNationalReferences', 'emis'],
  ['/emis/exchanges', 'emisExchanges', 'emis'],
  ['/references/entries', 'referenceEntries', 'references']
  ,
  ['/i18n/user-profiles', 'userLocalizationProfiles', 'i18n']
]);

const WORKFLOW_MANAGED_RESOURCES = new Set([
  'lmsAttempts',
  'meetingAttendance',
  'dataQualityRuns',
  'dataQualityIssues'
]);

function organizationId(request, service, candidate = null) {
  const identity = requireIdentity(request, service);
  const scoped = candidate ?? identity.organizationId ?? (identity.organizationIds.length === 1 ? identity.organizationIds[0] : null);
  if (!scoped) throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
  return { identity, scoped };
}

function registerCrud(router, service, [path, resource, permission]) {
  const handlers = makeCrudHandlers({
    service,
    resource,
    create: (body, actorId) => service.createPlatformRecord(resource, body, actorId),
    readPermission: `${permission}.read`,
    writePermission: `${permission}.write`,
    contextualResource: permission,
    listFilters: (url) => ({
      organizationId: url.searchParams.get('organizationId') ?? null,
      ...Object.fromEntries([...url.searchParams.entries()].filter(([key]) =>
        !['organizationId', 'limit', 'offset', 'includeArchived'].includes(key)
      )),
      ...parsePagination(url)
    })
  });
  if (!WORKFLOW_MANAGED_RESOURCES.has(resource)) router.add('POST', path, handlers.create);
  router.add('GET', path, handlers.list);
  router.add('GET', `${path}/:id`, handlers.get);
  if (!WORKFLOW_MANAGED_RESOURCES.has(resource)) {
    router.add('PUT', `${path}/:id`, handlers.update);
    router.add('DELETE', `${path}/:id`, handlers.remove);
  }

  router.add('GET', `${path}/:id/history`, handlers.history);
}

function assertEnrollmentAccess(service, identity, enrollment) {
  if (identity.permissions.includes('*') || identity.permissions.includes('lms.write')) return;
  const participant = service.lmsParticipants.get(enrollment.participantId);
  const accountPersonId = service.accounts.get(identity.accountId)?.personId;
  if (!participant || participant.personId !== accountPersonId) {
    throw new ApiError('FORBIDDEN', 'Learners can only access their own LMS enrollment.', 403);
  }
}

export function registerLearningSystemRoutes(router, { service }) {
  for (const definition of RESOURCE_ROUTES) registerCrud(router, service, definition);

  router.add('POST', '/lms/quizzes/:id/attempts', async (request, _url, params) => {
    const body = await parseJson(request);
    const quiz = await service.getCrudResource('lmsQuizzes', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: quiz.organizationId,
      permissions: ['lms.read']
    });
    const enrollment = await service.getCrudResource('lmsEnrollments', body.enrollmentId);
    if (enrollment.organizationId !== quiz.organizationId) throw new ApiError('FORBIDDEN', 'Cross-organization attempt is forbidden.', 403);
    assertEnrollmentAccess(service, identity, enrollment);

    return Response.json(await service.submitLmsQuizAttempt({
      ...body,
      quizId: params.id,
      organizationId: quiz.organizationId
    }, identity.actorId), { status: 201 });
  });

  router.add('GET', '/lms/enrollments/:id/progress-summary', async (request, _url, params) => {
    const enrollment = await service.getCrudResource('lmsEnrollments', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: enrollment.organizationId,
      permissions: ['lms.read']
    });
    assertEnrollmentAccess(service, identity, enrollment);
    const progress = service.getLmsEnrollmentProgress(params.id, enrollment.organizationId);
    return Response.json({
      enrollmentId: progress.enrollmentId,
      completedLessons: progress.completedLessons,
      totalLessons: progress.totalLessons,
      percent: progress.percent,
      completed: progress.completed
    });
  });

  router.add('GET', '/lms/enrollments/:id/progress-detail', async (request, _url, params) => {
    const enrollment = await service.getCrudResource('lmsEnrollments', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: enrollment.organizationId,
      permissions: ['lms.read']
    });
    assertEnrollmentAccess(service, identity, enrollment);
    return Response.json(service.getLmsEnrollmentProgress(params.id, enrollment.organizationId));
  });

  router.add('POST', '/lms/enrollments/:id/lessons/:lessonId/complete', async (request, _url, params) => {
    const enrollment = await service.getCrudResource('lmsEnrollments', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: enrollment.organizationId,
      permissions: ['lms.read']
    });
    assertEnrollmentAccess(service, identity, enrollment);
    return Response.json(await service.completeLmsLesson({
      organizationId: enrollment.organizationId,
      enrollmentId: enrollment.id,
      lessonId: params.lessonId
    }, identity.actorId), { status: 201 });
  });

  router.add('POST', '/lms/enrollments/:id/titles', async (request, _url, params) => {
    const enrollment = await service.getCrudResource('lmsEnrollments', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: enrollment.organizationId,
      permissions: ['lms.write', 'credentials.write']
    });
    return Response.json(await service.issueLmsTitle({
      ...(await parseJson(request)),
      organizationId: enrollment.organizationId,
      enrollmentId: enrollment.id
    }, identity.actorId), { status: 201 });
  });

  router.add('POST', '/meetings/:id/join', async (request, _url, params) => {
    const body = await parseJson(request);
    const meeting = await service.getCrudResource('meetings', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: meeting.organizationId,
      permissions: ['meetings.read']
    });
    const accountPersonId = service.accounts.get(identity.accountId)?.personId;
    if (accountPersonId !== body.personId && !identity.permissions.includes('meetings.write') && !identity.permissions.includes('*')) {
      throw new ApiError('FORBIDDEN', 'Participants can only request their own join details.', 403);
    }
    return Response.json(service.getMeetingJoinDetails(params.id, body.personId, meeting.organizationId));
  });

  router.add('POST', '/meetings/:id/attendance/import', async (request, _url, params) => {
    const meeting = await service.getCrudResource('meetings', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: meeting.organizationId,
      permissions: ['meetings.write']
    });
    return Response.json(await service.importMeetingAttendance(params.id, identity.actorId));
  });

  router.add('POST', '/data-quality/runs/execute', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['data-quality.write']
    });
    return Response.json(await service.runDataQuality(body, identity.actorId), { status: 201 });
  });

  for (const transition of ['correct', 'validate']) {
    router.add('POST', `/data-quality/issues/:id/${transition}`, async (request, _url, params) => {
      const issue = await service.getCrudResource('dataQualityIssues', params.id);
      const body = await parseJson(request);
      const identity = authorizeRequest(request, service, {
        organizationId: issue.organizationId,
        permissions: ['data-quality.write']
      });
      return Response.json(await service.transitionDataQualityIssue(params.id, transition, body, identity.actorId));
    });
  }

  router.add('POST', '/data-quality/prevalidate-export', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['data-quality.write']
    });
    return Response.json(await service.prevalidateExport(body, identity.actorId));
  });

  for (const action of ['transmit', 'retransmit']) {
    router.add('POST', `/emis/exchanges/:id/${action}`, async (request, _url, params) => {
      const exchange = await service.getCrudResource('emisExchanges', params.id);
      const identity = authorizeRequest(request, service, {
        organizationId: exchange.organizationId,
        permissions: ['emis.write']
      });
      return Response.json(await service.transmitEmisExchange(params.id, identity.actorId, {
        retransmission: action === 'retransmit'
      }));
    });
  }

  router.add('POST', '/emis/exchanges/:id/correct', async (request, _url, params) => {
    const exchange = await service.getCrudResource('emisExchanges', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: exchange.organizationId,
      permissions: ['emis.write']
    });
    return Response.json(await service.correctEmisExchange(params.id, body, identity.actorId));
  });

  router.add('POST', '/emis/exchanges/:id/acknowledge', async (request, _url, params) => {
    const exchange = await service.getCrudResource('emisExchanges', params.id);
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: exchange.organizationId,
      permissions: ['emis.write']
    });
    return Response.json(await service.acknowledgeEmisExchange(params.id, body, identity.actorId));
  });

  router.add('GET', '/references/:catalog', async (request, url, params) => {
    const { scoped } = organizationId(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId: scoped, permissions: ['references.read'] });
    return Response.json(service.listReferenceCatalog(params.catalog, {
      organizationId: scoped,
      countryCode: url.searchParams.get('countryCode'),
      language: url.searchParams.get('language') ?? 'fr'
    }));
  });
}
