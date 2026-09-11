import assert from 'node:assert/strict';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function startPlatform(options = {}) {
  const service = createPersistentEducationPlatformService({
    databaseUrl: 'sqlite::memory:',
    ...options
  });
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    service,
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await service.close();
    }
  };
}

async function request(baseUrl, path, { token, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

async function createTenant(service, suffix) {
  const { account } = await service.registerUser({
    givenName: 'Admin',
    familyName: suffix,
    username: `admin-${suffix}`,
    email: `admin-${suffix}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(account.id, {
    legalName: `École ${suffix}`,
    displayName: suffix,
    internalReference: `ORG-${suffix}`,
    countryCode: 'SN',
    organizationType: 'school'
  });
  const auth = await service.createAuthenticationSession(account, onboarding.organization.id);
  return { ...onboarding, token: auth.accessToken };
}

async function post(baseUrl, path, token, body) {
  return request(baseUrl, path, { token, method: 'POST', body, expected: 201 });
}

test('LMS flow links academics, progression, quiz, finance and credentials', async () => {
  const platform = await startPlatform();
  try {
    const tenant = await createTenant(platform.service, 'lms');
    const organizationId = tenant.organization.id;
    const actorId = tenant.account.id;
    const person = await platform.service.registerPerson({
      organizationId,
      primaryOrganizationId: organizationId,
      givenName: 'Élève',
      familyName: '国际'
    }, actorId);
    const year = await platform.service.createAcademicYear({
      organizationId, code: '2026', name: '2026', startsOn: '2026-09-01', endsOn: '2027-06-30'
    }, actorId);
    const academicProgram = await platform.service.createProgram({
      organizationId, academicYearId: year.id, code: 'P1', name: 'Programme'
    }, actorId);
    const academicPeriod = await platform.service.createAcademicPeriod({
      organizationId, academicYearId: year.id, periodType: 'semester', code: 'S1',
      name: 'Semestre 1', startsOn: '2026-09-01', endsOn: '2027-01-31'
    }, actorId);
    const subject = await platform.service.createSubject({
      organizationId, code: 'MATH', name: 'Mathématiques'
    }, actorId);
    const academicCourse = await platform.service.createCourse({
      organizationId, subjectId: subject.id, academicPeriodId: academicPeriod.id,
      programId: academicProgram.id, code: 'MATH-1', name: 'Mathématiques 1'
    }, actorId);
    const learner = await platform.service.createLearner({
      organizationId, personId: person.id, learnerNumber: 'L-1'
    }, actorId);

    const catalog = await post(platform.baseUrl, '/lms/catalogs', tenant.token, {
      organizationId, code: 'CAT', name: 'Catalogue'
    });
    const program = await post(platform.baseUrl, '/lms/programs', tenant.token, {
      organizationId, catalogId: catalog.id, academicProgramId: academicProgram.id,
      code: 'LP1', title: 'Parcours'
    });
    const course = await post(platform.baseUrl, '/lms/courses', tenant.token, {
      organizationId, programId: program.id, academicCourseId: academicCourse.id,
      code: 'LC1', title: 'Cours'
    });
    const module = await post(platform.baseUrl, '/lms/modules', tenant.token, {
      organizationId, courseId: course.id, title: 'Module 1', position: 1
    });
    const lesson = await post(platform.baseUrl, '/lms/lessons', tenant.token, {
      organizationId, moduleId: module.id, title: 'Leçon 1', position: 1
    });
    await post(platform.baseUrl, '/lms/resources', tenant.token, {
      organizationId, lessonId: lesson.id, title: 'Vidéo',
      externalReference: 'https://cdn.example.edu/video/1'
    });
    const participant = await post(platform.baseUrl, '/lms/participants', tenant.token, {
      organizationId, personId: person.id, learnerId: learner.id, role: 'learner'
    });
    const enrollment = await post(platform.baseUrl, '/lms/enrollments', tenant.token, {
      organizationId, participantId: participant.id, programId: program.id
    });
    const progress = await post(platform.baseUrl, '/lms/progress', tenant.token, {
      organizationId, enrollmentId: enrollment.id, lessonId: lesson.id, percent: 100
    });
    assert.ok(progress.completedAt);
    const summary = await request(platform.baseUrl, `/lms/enrollments/${enrollment.id}/progress-summary`, {
      token: tenant.token
    });
    assert.deepEqual(summary, {
      enrollmentId: enrollment.id,
      completedLessons: 1,
      totalLessons: 1,
      percent: 100,
      completed: true
    });

    const quiz = await post(platform.baseUrl, '/lms/quizzes', tenant.token, {
      organizationId, courseId: course.id, title: 'Quiz', passingScore: 50
    });
    const question = await post(platform.baseUrl, '/lms/questions', tenant.token, {
      organizationId, quizId: quiz.id, prompt: '2 + 2 ?', questionType: 'single',
      options: ['3', '4'], correctAnswer: '4'
    });
    await request(platform.baseUrl, '/lms/attempts', {
      token: tenant.token,
      method: 'POST',
      body: { organizationId, quizId: quiz.id, enrollmentId: enrollment.id, score: 100, passed: true },
      expected: 404
    });
    const attempt = await post(platform.baseUrl, `/lms/quizzes/${quiz.id}/attempts`, tenant.token, {
      enrollmentId: enrollment.id, answers: { [question.id]: '4' }
    });
    assert.equal(attempt.score, 100);
    assert.equal(attempt.passed, true);

    const fee = await platform.service.configureFee({
      organizationId, feeType: 'LMS', amount: 25, currency: 'XOF'
    }, actorId);
    const invoice = await platform.service.createInvoice({
      organizationId, learnerId: learner.id, feeConfigurationId: fee.id, amount: 25, currency: 'XOF'
    }, actorId);
    const payment = await platform.service.recordPayment({
      organizationId, invoiceId: invoice.id, amount: 25, currency: 'XOF'
    }, actorId);
    const document = await platform.service.registerDocument({
      organizationId, personId: person.id, type: 'certificate', title: 'Attestation',
      storageReference: 'storage://certificate/1'
    }, actorId);
    const credential = await platform.service.issueCredential({
      organizationId, personId: person.id, documentId: document.id,
      credentialType: 'certificate', qualification: 'Parcours LMS'
    }, actorId);
    await post(platform.baseUrl, '/lms/payments', tenant.token, {
      organizationId, enrollmentId: enrollment.id, invoiceId: invoice.id, paymentId: payment.id
    });
    await post(platform.baseUrl, '/lms/certificates', tenant.token, {
      organizationId, enrollmentId: enrollment.id, credentialId: credential.id
    });
    assert.equal((await request(platform.baseUrl, '/lms/certificates', { token: tenant.token })).page.total, 1);
  } finally {
    await platform.close();
  }
});

test('meeting permissions and external attendance state are explicit', async () => {
  const platform = await startPlatform();
  try {
    const tenant = await createTenant(platform.service, 'meeting');
    const organizationId = tenant.organization.id;
    const person = await platform.service.registerPerson({
      organizationId, primaryOrganizationId: organizationId, givenName: 'Awa', familyName: 'Diallo'
    }, tenant.account.id);
    const provider = await post(platform.baseUrl, '/meetings/providers', tenant.token, {
      organizationId, code: 'vendor', providerType: 'external', configuration: { region: 'eu' }
    });
    await request(platform.baseUrl, '/meetings/providers', {
      token: tenant.token,
      method: 'POST',
      body: {
        organizationId,
        code: 'unsafe',
        providerType: 'external',
        configuration: { oauth: { clientSecret: 'must-not-be-stored' } }
      },
      expected: 400
    });
    const meeting = await post(platform.baseUrl, '/meetings', tenant.token, {
      organizationId, providerId: provider.id, externalMeetingId: 'ext-1',
      externalUrl: 'https://meet.example.edu/ext-1', startsAt: '2026-09-12T12:00:00Z',
      timezone: 'Africa/Dakar'
    });
    await post(platform.baseUrl, '/meetings/participants', tenant.token, {
      organizationId, meetingId: meeting.id, personId: person.id, role: 'attendee',
      canJoin: true, permissions: ['audio']
    });
    const join = await request(platform.baseUrl, `/meetings/${meeting.id}/join`, {
      token: tenant.token, method: 'POST', body: { personId: person.id }
    });
    assert.equal(join.externalUrl, 'https://meet.example.edu/ext-1');
    const attendance = await request(platform.baseUrl, `/meetings/${meeting.id}/attendance/import`, {
      token: tenant.token, method: 'POST', body: {}
    });
    assert.equal(attendance.state, 'pending_external');
  } finally {
    await platform.close();
  }
});

test('data quality scoring, correction, EMIS retry, references, i18n and tenant isolation work', async () => {
  let shouldFail = true;
  const platform = await startPlatform({
    externalAdapters: {
      emis: {
        national: {
          async transmit() {
            if (shouldFail) throw new Error('National endpoint unavailable');
            return { externalReference: 'ACK-42' };
          }
        }
      }
    }
  });
  try {
    const tenant = await createTenant(platform.service, 'quality');
    const other = await createTenant(platform.service, 'other');
    const organizationId = tenant.organization.id;
    const person = await platform.service.registerPerson({
      organizationId, primaryOrganizationId: organizationId, givenName: 'Noémie', familyName: 'École'
    }, tenant.account.id);
    const rule = await post(platform.baseUrl, '/data-quality/rules', tenant.token, {
      organizationId, code: 'PERSON-ID', countryCode: 'SN', dimension: 'identifiers',
      targetResource: 'people', field: 'nationalIdentifier', operator: 'required', weight: 2
    });
    assert.equal(rule.dimension, 'identifiers');
    const run = await post(platform.baseUrl, '/data-quality/runs/execute', tenant.token, {
      organizationId, countryCode: 'SN', targetResource: 'people'
    });
    assert.ok(run.score < 100);
    const issues = await request(platform.baseUrl, `/data-quality/issues?organizationId=${organizationId}&runId=${run.id}`, { token: tenant.token });
    const issue = issues.items.find((item) => item.targetId === person.id);
    assert.ok(issue);
    await request(platform.baseUrl, `/data-quality/issues/${issue.id}/correct`, {
      token: tenant.token, method: 'POST', body: { correction: { nationalIdentifier: 'SN-001' } }
    });
    const validated = await request(platform.baseUrl, `/data-quality/issues/${issue.id}/validate`, {
      token: tenant.token, method: 'POST', body: {}
    });
    assert.equal(validated.issueState, 'validated');

    const profile = await post(platform.baseUrl, '/emis/profiles', tenant.token, {
      organizationId, code: 'SN-EMIS', countryCode: 'SN', adapterKey: 'national',
      direction: 'bidirectional', configuration: { version: '2026' }
    });
    await post(platform.baseUrl, '/emis/mappings', tenant.token, {
      organizationId, profileId: profile.id, sourceField: 'learnerNumber',
      targetField: 'student_id', valueMapping: {}
    });
    const exchange = await post(platform.baseUrl, '/emis/exchanges', tenant.token, {
      organizationId, profileId: profile.id, direction: 'export',
      payload: { learners: [{ learnerNumber: 'L-1' }] }
    });
    const failed = await request(platform.baseUrl, `/emis/exchanges/${exchange.id}/transmit`, {
      token: tenant.token, method: 'POST', body: {}
    });
    assert.equal(failed.exchangeState, 'transport_error');
    shouldFail = false;
    const sent = await request(platform.baseUrl, `/emis/exchanges/${exchange.id}/retransmit`, {
      token: tenant.token, method: 'POST', body: {}
    });
    assert.equal(sent.exchangeState, 'sent');
    assert.equal(sent.attempts.length, 2);
    const acknowledged = await request(platform.baseUrl, `/emis/exchanges/${exchange.id}/acknowledge`, {
      token: tenant.token, method: 'POST', body: { accepted: true, reference: 'ACK-42' }
    });
    assert.equal(acknowledged.exchangeState, 'acknowledged');

    const isced = await request(platform.baseUrl, `/references/isced?organizationId=${organizationId}&language=en`, { token: tenant.token });
    assert.equal(isced.items[0].code, 'ISCED-1');
    const tenantReference = await post(platform.baseUrl, '/references/entries', tenant.token, {
      organizationId, catalog: 'subjects', code: 'ROBOTICS',
      labels: { fr: 'Robotique', en: 'Robotics' }, standard: true
    });
    assert.equal(tenantReference.standard, false);
    await platform.service.upsertLocalizationProfile({
      organizationId, countryCode: 'SN', city: 'Dakar', language: 'fr',
      currency: 'XOF', timezone: 'Africa/Dakar', calendar: 'gregory'
    }, tenant.account.id);
    const money = await request(platform.baseUrl, '/i18n/format', {
      token: tenant.token, method: 'POST',
      body: { organizationId, type: 'currency', value: 1250.5 }
    });
    assert.match(money.formatted, /1.?251/);

    await request(platform.baseUrl, `/emis/exchanges?organizationId=${organizationId}`, {
      token: other.token, expected: 403
    });
  } finally {
    await platform.close();
  }
});

test('PostgreSQL async persistence commits LMS and EMIS state before returning', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const databaseUrl = 'postgresql://memory/learning-systems';
  const connection = await createPostgresConnection(databaseUrl, { Pool });
  const service = await initializePersistentEducationPlatformService({ connection });
  try {
    const tenant = await createTenant(service, 'postgres-lms');
    const organizationId = tenant.organization.id;
    const catalog = await service.createPlatformRecord('lmsCatalogs', {
      organizationId, code: 'PG-CAT', name: 'Catalogue PostgreSQL'
    }, tenant.account.id);
    const profile = await service.createPlatformRecord('emisProfiles', {
      organizationId, code: 'PG-EMIS', countryCode: 'SN',
      direction: 'export', configuration: {}
    }, tenant.account.id);
    const exchange = await service.createPlatformRecord('emisExchanges', {
      organizationId, profileId: profile.id, direction: 'export',
      payload: { learnerNumber: 'PG-1' }
    }, tenant.account.id);
    const pending = await service.transmitEmisExchange(exchange.id, tenant.account.id);
    assert.equal(pending.exchangeState, 'pending_external');
    assert.equal((await service.repositories.lmsCatalogs.get(catalog.id)).code, 'PG-CAT');
    assert.equal((await service.repositories.emisExchanges.get(exchange.id)).exchangeState, 'pending_external');
  } finally {
    await service.close();
  }

  const reloadedConnection = await createPostgresConnection(databaseUrl, { Pool });
  const reloaded = await initializePersistentEducationPlatformService({ connection: reloadedConnection });
  try {
    assert.equal(reloaded.lmsCatalogs.size, 1);
    assert.equal(reloaded.emisExchanges.size, 1);
    assert.equal([...reloaded.emisExchanges.values()][0].attempts.length, 1);
  } finally {
    await reloaded.close();
  }
});
