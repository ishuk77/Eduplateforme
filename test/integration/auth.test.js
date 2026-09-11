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
    const refreshCookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
    assert.ok(loginPayload.accessToken);
    assert.equal('refreshToken' in loginPayload, false);
    assert.ok(refreshCookie);
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
      headers: { 'content-type': 'application/json', cookie: refreshCookie },
      body: '{}'
    });
    assert.equal(refreshResponse.status, 200);
    assert.equal('refreshToken' in await refreshResponse.json(), false);

    const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
      method: 'DELETE',
      headers: {
        authorization: bearerToken,
        'content-type': 'application/json',
        cookie: refreshCookie
      },
      body: '{}'
    });
    assert.equal(logoutResponse.status, 200);
    assert.match(logoutResponse.headers.get('set-cookie') ?? '', /Max-Age=0/);
  });
});

test('account memberships are immutable through CRUD and permissions stay tenant-scoped', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const organizationA = service.createOrganization({
    legalName: 'Tenant A',
    displayName: 'A',
    internalReference: 'TENANT-A',
    countryCode: 'SN'
  }, 'bootstrap');
  const organizationB = service.createOrganization({
    legalName: 'Tenant B',
    displayName: 'B',
    internalReference: 'TENANT-B',
    countryCode: 'SN'
  }, 'bootstrap');
  const personA = service.registerPerson({
    givenName: 'Admin',
    familyName: 'A',
    primaryOrganizationId: organizationA.id
  }, 'bootstrap');
  const personB = service.registerPerson({
    givenName: 'Member',
    familyName: 'B',
    primaryOrganizationId: organizationB.id
  }, 'bootstrap');
  const accountA = service.openUserAccount({
    personId: personA.id,
    username: 'tenant-a-admin',
    email: 'tenant-a@example.edu',
    password: 'super-secret-password',
    organizationIds: [organizationA.id]
  }, 'bootstrap');
  const permissionCodes = ['accounts.read', 'accounts.write', 'people.read', 'people.write'];
  permissionCodes.forEach((code) => service.createPermission({ code, description: code }, 'bootstrap'));
  const roleA = service.createRole({
    code: 'tenant-a-admin',
    name: 'Tenant A admin',
    permissions: permissionCodes
  }, 'bootstrap');
  service.assignRole({
    personId: personA.id,
    roleId: roleA.id,
    organizationId: organizationA.id
  }, 'bootstrap');

  await withServer(service, async (baseUrl) => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'tenant-a-admin',
        password: 'super-secret-password',
        organizationId: organizationA.id
      })
    });
    const login = await loginResponse.json();
    const headers = {
      authorization: `Bearer ${login.accessToken}`,
      'content-type': 'application/json'
    };

    const membershipUpdate = await fetch(`${baseUrl}/accounts/${accountA.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ organizationIds: [organizationA.id, organizationB.id] })
    });
    assert.equal(membershipUpdate.status, 400);
    assert.deepEqual(accountA.organizationIds, [organizationA.id]);

    // Simulate a pre-existing bad membership to verify permissions are still checked in tenant B.
    accountA.organizationIds.push(organizationB.id);
    const readTenantB = await fetch(
      `${baseUrl}/people?organizationId=${organizationB.id}`,
      { headers: { authorization: headers.authorization } }
    );
    assert.equal(readTenantB.status, 403);

    const writeTenantB = await fetch(`${baseUrl}/people/${personB.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ preferredName: 'Forbidden change' })
    });
    assert.equal(writeTenantB.status, 403);
    assert.equal(personB.preferredName, null);
  });
});
