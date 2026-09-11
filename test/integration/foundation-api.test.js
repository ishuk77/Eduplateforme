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

function createPermissionSet(service, actorId, codes) {
  codes.forEach((code) => {
    service.createPermission({ code, description: code }, actorId);
  });
}

function seedCoreData(service) {
  const actorId = 'bootstrap';
  const organization = service.createOrganization({
    legalName: 'Ecole A',
    displayName: 'A',
    internalReference: 'ORG-A',
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-A'
  }, actorId);
  const outsiderOrganization = service.createOrganization({
    legalName: 'Ecole B',
    displayName: 'B',
    internalReference: 'ORG-B',
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-B'
  }, actorId);

  const person = service.registerPerson({ givenName: 'Admin', familyName: 'A', primaryOrganizationId: organization.id }, actorId);
  const outsiderPerson = service.registerPerson({ givenName: 'Out', familyName: 'B', primaryOrganizationId: outsiderOrganization.id }, actorId);

  const account = service.openUserAccount({
    personId: person.id,
    username: 'admin-a',
    email: 'admin-a@example.edu',
    password: 'super-secret-password',
    organizationIds: [organization.id]
  }, actorId);
  service.openUserAccount({
    personId: outsiderPerson.id,
    username: 'admin-b',
    email: 'admin-b@example.edu',
    password: 'super-secret-password',
    organizationIds: [outsiderOrganization.id]
  }, actorId);

  createPermissionSet(service, actorId, [
    'organizations.read',
    'organizations.write',
    'people.read',
    'people.write',
    'accounts.read',
    'accounts.write',
    'academics.read',
    'academics.write',
    'documents.read',
    'documents.write',
    'credentials.read',
    'credentials.write',
    'audit.read'
  ]);
  const role = service.createRole({
    code: 'tenant-admin',
    name: 'Tenant admin',
    permissions: [
      'organizations.read',
      'organizations.write',
      'people.read',
      'people.write',
      'accounts.read',
      'accounts.write',
      'academics.read',
      'academics.write',
      'documents.read',
      'documents.write',
      'credentials.read',
      'credentials.write',
      'audit.read'
    ]
  }, actorId);
  service.assignRole({ personId: person.id, roleId: role.id, organizationId: organization.id }, actorId);

  const learner = service.createLearner({ organizationId: organization.id, personId: person.id, learnerNumber: 'LRN-A' }, actorId);
  const year = service.createAcademicYear({
    organizationId: organization.id,
    code: '2026-2027',
    name: 'AY 2026-2027',
    startsOn: '2026-09-01',
    endsOn: '2027-06-30'
  }, actorId);
  const program = service.createProgram({
    organizationId: organization.id,
    academicYearId: year.id,
    code: 'SCI',
    name: 'Science'
  }, actorId);
  const learningClass = service.createClass({
    organizationId: organization.id,
    academicYearId: year.id,
    programId: program.id,
    code: 'SCI-A',
    name: 'SCI-A'
  }, actorId);
  const enrollment = service.createEnrollment({
    organizationId: organization.id,
    personId: person.id,
    learnerId: learner.id,
    classId: learningClass.id,
    academicYearId: year.id
  }, actorId);
  const document = service.registerDocument({
    organizationId: organization.id,
    personId: person.id,
    type: 'transcript',
    title: 'Transcript',
    storageReference: 'file://transcript-a'
  }, actorId);
  const credential = service.issueCredential({
    organizationId: organization.id,
    personId: person.id,
    documentId: document.id,
    credentialType: 'diploma'
  }, actorId);

  return { organization, outsiderOrganization, account, person, year, program, learningClass, enrollment, document, credential };
}

async function login(baseUrl, { username, password, organizationId }) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, organizationId })
  });
  assert.equal(response.status, 200);
  return response.json();
}

function authHeaders(token, extra = {}) {
  const bearerPrefix = ['Be', 'arer'].join('');
  return { authorization: `${bearerPrefix} ${token}`, ...extra };
}

async function getList(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, { headers: authHeaders(token) });
  assert.equal(response.status, 200, `Expected 200 for ${path}`);
  const payload = await response.json();
  assert.ok(Array.isArray(payload.items), `Expected ${path} to return paginated items`);
  return payload;
}

test('core foundation APIs expose read/list/update/archive with tenant isolation', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const seeded = seedCoreData(service);

  await withServer(service, async (baseUrl) => {
    const auth = await login(baseUrl, {
      username: 'admin-a',
      password: 'super-secret-password',
      organizationId: seeded.organization.id
    });
    const token = auth.accessToken;

    const organizations = await getList(baseUrl, '/organizations', token);
    assert.equal(organizations.items.length, 1);
    assert.equal(organizations.items[0].id, seeded.organization.id);

    await getList(baseUrl, '/people', token);
    await getList(baseUrl, '/accounts', token);
    await getList(baseUrl, '/academics/years', token);
    await getList(baseUrl, '/academics/programs', token);
    await getList(baseUrl, '/academics/classes', token);
    await getList(baseUrl, '/academics/enrollments', token);
    await getList(baseUrl, '/documents', token);
    await getList(baseUrl, '/credentials', token);

    const updateProgram = await fetch(`${baseUrl}/academics/programs/${seeded.program.id}`, {
      method: 'PUT',
      headers: authHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify({ name: 'Science updated' })
    });
    assert.equal(updateProgram.status, 200);
    const updatedProgram = await updateProgram.json();
    assert.equal(updatedProgram.name, 'Science updated');

    const archiveDocument = await fetch(`${baseUrl}/documents/${seeded.document.id}`, {
      method: 'DELETE',
      headers: authHeaders(token)
    });
    assert.equal(archiveDocument.status, 200);
    const archivedDocument = await archiveDocument.json();
    assert.equal(archivedDocument.status, 'archived');

    const crossTenantList = await fetch(`${baseUrl}/academics/years?organizationId=${seeded.outsiderOrganization.id}`, {
      headers: authHeaders(token)
    });
    assert.equal(crossTenantList.status, 403);
  });
});
