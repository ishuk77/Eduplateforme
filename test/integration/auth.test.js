import test from 'node:test';
import assert from 'node:assert/strict';

import { createPersistentEducationPlatformService } from '../../src/services/persistent-education-platform-service.js';
import { createHttpServer } from '../../src/http/server.js';

async function withServer(service, run) {
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function seedAuthorizedAccount(service) {
  const organization = service.createOrganization({
    legalName: 'Ecole Secure',
    displayName: 'Secure',
    internalReference: 'ORG-SECURE',
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-SECURE'
  }, 'bootstrap');
  const outsiderOrganization = service.createOrganization({
    legalName: 'Ecole Other',
    displayName: 'Other',
    internalReference: 'ORG-OTHER',
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-OTHER'
  }, 'bootstrap');
  const person = service.registerPerson({ givenName: 'Admin', familyName: 'User', primaryOrganizationId: organization.id }, 'bootstrap');
  const account = service.openUserAccount({
    personId: person.id,
    username: 'admin',
    email: 'admin@example.edu',
    password: 'super-secret-password',
    organizationIds: [organization.id]
  }, 'bootstrap');

  const calendarRead = service.createPermission({ code: 'calendar.read', description: 'Read calendar' }, 'bootstrap');
  const calendarWrite = service.createPermission({ code: 'calendar.write', description: 'Write calendar' }, 'bootstrap');
  const auditRead = service.createPermission({ code: 'audit.read', description: 'Read audit' }, 'bootstrap');
  const role = service.createRole({ code: 'admin', name: 'Admin', permissions: [calendarRead.code, calendarWrite.code, auditRead.code] }, 'bootstrap');
  service.assignRole({ personId: person.id, roleId: role.id, organizationId: organization.id }, 'bootstrap');

  return { organization, outsiderOrganization, account };
}

test('JWT auth enforces organization-scoped access and exposes /auth/me', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const { organization, outsiderOrganization } = seedAuthorizedAccount(service);

  await withServer(service, async (baseUrl) => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'super-secret-password', organizationId: organization.id })
    });
    assert.equal(loginResponse.status, 200);
    const loginPayload = await loginResponse.json();
    assert.ok(loginPayload.accessToken);
    assert.ok(loginPayload.refreshToken);
    const bearerToken = 'Bearer ' + loginPayload.accessToken;

    const meResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: bearerToken }
    });
    assert.equal(meResponse.status, 200);
    const me = await meResponse.json();
    assert.equal(me.username, 'admin');
    assert.equal(me.organizationId, organization.id);
    assert.ok(me.permissions.includes('calendar.write'));

    const createAllowed = await fetch(`${baseUrl}/calendar/events`, {
      method: 'POST',
      headers: {
        authorization: bearerToken,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        organizationId: organization.id,
        title: 'Conseil de classe',
        eventType: 'meeting',
        startsAt: '2026-11-10T10:00:00Z',
        endsAt: '2026-11-10T12:00:00Z'
      })
    });
    assert.equal(createAllowed.status, 201);

    const createForbidden = await fetch(`${baseUrl}/calendar/events`, {
      method: 'POST',
      headers: {
        authorization: bearerToken,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        organizationId: outsiderOrganization.id,
        title: 'Interdit',
        eventType: 'meeting',
        startsAt: '2026-11-10T10:00:00Z',
        endsAt: '2026-11-10T12:00:00Z'
      })
    });
    assert.equal(createForbidden.status, 403);

    const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginPayload.refreshToken })
    });
    assert.equal(refreshResponse.status, 200);

    const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
      method: 'DELETE',
      headers: {
        authorization: bearerToken,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ refreshToken: loginPayload.refreshToken })
    });
    assert.equal(logoutResponse.status, 200);
  });
});
