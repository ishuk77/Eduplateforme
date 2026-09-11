import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpServer } from '../../src/http/server.js';
import { createPersistentEducationPlatformService } from '../../src/services/persistent-education-platform-service.js';

async function withServer(run) {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await service.close();
  }
}

async function request(baseUrl, path, { token, method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

async function create(baseUrl, path, token, body) {
  const result = await request(baseUrl, path, { token, method: 'POST', body });
  assert.equal(result.response.status, 201, `${path}: ${JSON.stringify(result.payload)}`);
  return result.payload;
}

test('registration, onboarding and every navigation module work through real APIs', async () => {
  await withServer(async (baseUrl) => {
    const registration = await request(baseUrl, '/auth/register', {
      method: 'POST',
      body: {
        givenName: 'Awa',
        familyName: 'Diallo',
        username: 'awa.admin',
        email: 'awa@example.edu',
        password: 'correct-horse-battery'
      }
    });
    assert.equal(registration.response.status, 201);
    assert.match(registration.response.headers.get('set-cookie') ?? '', /HttpOnly/);
    assert.match(registration.response.headers.get('set-cookie') ?? '', /SameSite=Strict/);
    assert.equal('refreshToken' in registration.payload, false);
    assert.equal(registration.payload.user.organizationIds.length, 0);

    const beforeOnboarding = await request(baseUrl, '/auth/me', {
      token: registration.payload.accessToken
    });
    assert.equal(beforeOnboarding.response.status, 200);
    assert.equal(beforeOnboarding.payload.organizationId, null);

    const onboarding = await request(baseUrl, '/auth/onboarding', {
      token: registration.payload.accessToken,
      method: 'POST',
      body: {
        legalName: 'École Horizon',
        displayName: 'Horizon',
        internalReference: 'HORIZON-001',
        countryCode: 'SN',
        organizationType: 'school'
      }
    });
    assert.equal(onboarding.response.status, 200, JSON.stringify(onboarding.payload));
    assert.equal('refreshToken' in onboarding.payload, false);
    assert.match(onboarding.response.headers.get('set-cookie') ?? '', /HttpOnly/);
    const token = onboarding.payload.accessToken;
    const organizationId = onboarding.payload.user.organizationId;
    assert.ok(organizationId);
    assert.ok(onboarding.payload.user.permissions.includes('audit.read'));

    const organizations = await request(baseUrl, '/organizations', { token });
    assert.equal(organizations.response.status, 200);
    assert.equal(organizations.payload.items[0].displayName, 'Horizon');

    const secondOrganization = await create(baseUrl, '/organizations', token, {
      legalName: 'École Horizon Annexe',
      displayName: 'Horizon Annexe',
      internalReference: 'HORIZON-002',
      countryCode: 'SN',
      organizationType: 'campus'
    });
    assert.ok(secondOrganization.id);
    const organizationsAfterCreate = await request(baseUrl, '/organizations', { token });
    assert.equal(organizationsAfterCreate.payload.page.total, 2);

    const person = await create(baseUrl, '/people', token, {
      givenName: 'Moussa',
      familyName: 'Ndiaye',
      primaryOrganizationId: organizationId
    });
    const year = await create(baseUrl, '/academics/years', token, {
      organizationId,
      code: '2026-2027',
      name: 'Année 2026-2027',
      startsOn: '2026-09-01',
      endsOn: '2027-06-30'
    });
    const program = await create(baseUrl, '/academics/programs', token, {
      organizationId,
      academicYearId: year.id,
      code: 'COLLEGE',
      name: 'Collège'
    });
    const learningClass = await create(baseUrl, '/academics/classes', token, {
      organizationId,
      academicYearId: year.id,
      programId: program.id,
      code: '6A',
      name: 'Sixième A'
    });
    const learner = await create(baseUrl, '/academics/learners', token, {
      organizationId,
      personId: person.id,
      learnerNumber: 'ELV-001'
    });
    await create(baseUrl, '/academics/enrollments', token, {
      organizationId,
      personId: person.id,
      learnerId: learner.id,
      classId: learningClass.id,
      academicYearId: year.id,
      enrollmentReference: 'INS-001'
    });

    const report = await create(baseUrl, '/reports/cards', token, {
      organizationId,
      learnerId: learner.id,
      period: 'Trimestre 1',
      appreciation: 'Début de parcours'
    });
    assert.equal(report.average, 0);

    const thread = await create(baseUrl, '/communications/threads', token, {
      organizationId,
      title: 'Bienvenue',
      scope: 'school'
    });
    await create(baseUrl, '/communications/messages', token, {
      organizationId,
      threadId: thread.id,
      authorPersonId: person.id,
      content: 'Bienvenue dans votre espace.'
    });

    await create(baseUrl, '/discipline/records', token, {
      organizationId,
      learnerId: learner.id,
      type: 'reward',
      description: 'Participation exemplaire',
      severity: 'low'
    });
    await create(baseUrl, '/calendar/events', token, {
      organizationId,
      title: 'Réunion de rentrée',
      eventType: 'meeting',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z'
    });
    await create(baseUrl, '/subscriptions/platform', token, {
      organizationId,
      plan: 'free',
      startsOn: '2026-09-01'
    });

    const document = await create(baseUrl, '/documents', token, {
      organizationId,
      personId: person.id,
      type: 'identity',
      title: 'Pièce d’identité',
      storageReference: 'secure://documents/identity-001'
    });
    await create(baseUrl, '/credentials', token, {
      organizationId,
      personId: person.id,
      documentId: document.id,
      credentialType: 'identity-proof'
    });

    const audit = await request(baseUrl, `/audit/trail?organizationId=${organizationId}`, { token });
    assert.equal(audit.response.status, 200);
    assert.ok(audit.payload.page.total > 0);

    const login = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: { username: 'awa.admin', password: 'correct-horse-battery' }
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.user.organizationId, organizationId);
    assert.equal('refreshToken' in login.payload, false);
    const loginCookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(loginCookie);

    const refresh = await request(baseUrl, '/auth/refresh', {
      method: 'POST',
      body: {},
      cookie: loginCookie
    });
    assert.equal(refresh.response.status, 200);
    assert.ok(refresh.payload.accessToken);
    assert.equal('refreshToken' in refresh.payload, false);
  });
});
