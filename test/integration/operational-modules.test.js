import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpServer } from '../../src/http/server.js';
import { createPersistentEducationPlatformService } from '../../src/services/persistent-education-platform-service.js';

async function withServer(run) {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await service.close();
  }
}

async function api(baseUrl, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function post(baseUrl, path, token, body) {
  return api(baseUrl, path, { token, method: 'POST', body });
}

test('all operational modules expose tenant-scoped end-to-end HTTP flows', async () => {
  await withServer(async (baseUrl) => {
    const registration = await post(baseUrl, '/auth/register', null, {
      givenName: 'Admin', familyName: 'Modules', username: 'modules-admin',
      email: 'modules@example.edu', password: 'correct-horse-battery'
    });
    const onboarding = await post(baseUrl, '/auth/onboarding', registration.accessToken, {
      legalName: 'École Modules', displayName: 'Modules', internalReference: 'MOD-001',
      countryCode: 'SN', organizationType: 'school'
    });
    const token = onboarding.accessToken;
    const organizationId = onboarding.user.organizationId;
    const person = await post(baseUrl, '/people', token, {
      organizationId, primaryOrganizationId: organizationId, givenName: 'Lina', familyName: 'Test'
    });
    const teacher = await post(baseUrl, '/people', token, {
      organizationId, primaryOrganizationId: organizationId, givenName: 'Tara', familyName: 'Prof'
    });
    const year = await post(baseUrl, '/academics/years', token, {
      organizationId, code: '2026', name: '2026', startsOn: '2026-09-01', endsOn: '2027-06-30'
    });
    const program = await post(baseUrl, '/academics/programs', token, {
      organizationId, academicYearId: year.id, code: 'P1', name: 'Programme'
    });
    const learningClass = await post(baseUrl, '/academics/classes', token, {
      organizationId, academicYearId: year.id, programId: program.id, code: 'C1', name: 'Classe 1'
    });
    const learner = await post(baseUrl, '/academics/learners', token, {
      organizationId, personId: person.id, learnerNumber: 'L-001'
    });

    const assignment = await post(baseUrl, '/assignments', token, {
      organizationId, classId: learningClass.id, title: 'Fractions', type: 'homework',
      dueAt: '2026-09-20T10:00:00Z'
    });
    const submission = await post(baseUrl, '/assignments/submissions', token, {
      organizationId, assignmentId: assignment.id, learnerId: learner.id,
      contentReference: 'storage://submissions/fractions'
    });
    const grade = await post(baseUrl, '/assignments/submissions/grade', token, {
      submissionId: submission.id, score: 16, maxScore: 20, coefficient: 2
    });
    assert.equal(grade.score, 16);
    assert.equal((await api(baseUrl, '/assignments/submissions', { token })).page.total, 1);

    await post(baseUrl, '/grading/systems', token, {
      organizationId, name: 'Barème principal', format: '/20', passingThreshold: 10
    });
    assert.equal((await api(baseUrl, '/grading/systems', { token })).page.total, 1);
    assert.equal((await api(baseUrl, `/grading/average?organizationId=${organizationId}&learnerId=${learner.id}`, { token })).averageOn20, 16);

    await post(baseUrl, '/attendance/records', token, {
      organizationId, learnerId: learner.id, classId: learningClass.id, date: '2026-09-11', status: 'present'
    });
    assert.equal((await api(baseUrl, `/attendance/rate?organizationId=${organizationId}&learnerId=${learner.id}`, { token })).rate, 100);

    await post(baseUrl, '/scheduling/entries', token, {
      organizationId, classId: learningClass.id, subject: 'Mathématiques',
      teacherPersonId: teacher.id, dayOfWeek: 'monday', startsAt: '08:00', endsAt: '09:00'
    });
    assert.equal((await api(baseUrl, '/scheduling/entries', { token })).page.total, 1);

    const fee = await post(baseUrl, '/finance/fees', token, {
      organizationId, feeType: 'Scolarité', amount: 100, currency: 'USD'
    });
    const invoice = await post(baseUrl, '/finance/invoices', token, {
      organizationId, learnerId: learner.id, feeConfigurationId: fee.id, amount: 100, currency: 'USD'
    });
    await post(baseUrl, '/finance/payments', token, {
      organizationId, invoiceId: invoice.id, amount: 40, currency: 'USD', channel: 'cash'
    });
    assert.equal((await api(baseUrl, `/finance/invoices/${invoice.id}`, { token })).balance, 60);

    const notification = await post(baseUrl, '/notifications', token, {
      organizationId, eventType: 'school.reminder', channel: 'internal', recipientId: learner.id
    });
    await post(baseUrl, '/notifications/sent', token, { notificationId: notification.id });
    assert.ok((await api(baseUrl, `/notifications/${notification.id}`, { token })).sentAt);

    const virtualSchool = await post(baseUrl, '/virtual-schools', token, {
      organizationId, name: 'Académie numérique', timezone: 'Africa/Dakar'
    });
    await post(baseUrl, '/virtual-schools/trainings', token, {
      organizationId, virtualSchoolId: virtualSchool.id, title: 'Révisions',
      pricingModel: 'paid', amount: 25, currency: 'USD', platformCommissionRate: 10
    });
    assert.equal((await api(baseUrl, '/virtual-schools/trainings', { token })).page.total, 1);

    await post(baseUrl, '/certificates', token, {
      organizationId, learnerId: learner.id, certificateType: 'completion',
      title: 'Réussite', verificationCode: 'VERIFY-001'
    });
    assert.equal((await api(baseUrl, '/certificates', { token })).page.total, 1);

    await post(baseUrl, '/i18n/profiles', token, {
      organizationId, countryCode: 'SN', city: 'Dakar', language: 'fr',
      currency: 'USD', timezone: 'Africa/Dakar', dateFormat: 'DD/MM/YYYY'
    });
    assert.equal((await api(baseUrl, '/i18n/profile', { token })).city, 'Dakar');

    await post(baseUrl, '/security/parental-consents', token, {
      organizationId, learnerId: learner.id, parentPersonId: person.id,
      scope: 'online-learning', grantedAt: '2026-09-11T12:00:00Z'
    });
    assert.equal((await api(baseUrl, '/security/parental-consents', { token })).page.total, 1);

    const forbidden = await fetch(`${baseUrl}/finance/invoices?organizationId=another-tenant`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(forbidden.status, 403);
  });
});
