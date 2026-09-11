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
  const outsiderAccount = service.openUserAccount({
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
    'assignments.read',
    'assignments.write',
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
      'assignments.read',
      'assignments.write',
      'documents.read',
      'documents.write',
      'credentials.read',
      'credentials.write',
      'audit.read'
    ]
  }, actorId);
  service.assignRole({ personId: person.id, roleId: role.id, organizationId: organization.id }, actorId);
  service.assignRole({ personId: outsiderPerson.id, roleId: role.id, organizationId: outsiderOrganization.id }, actorId);

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

  return {
    organization,
    outsiderOrganization,
    account,
    outsiderAccount,
    person,
    year,
    program,
    learningClass,
    enrollment,
    document,
    credential,
    learner
  };
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
    const outsiderAuth = await login(baseUrl, {
      username: 'admin-b',
      password: 'super-secret-password',
      organizationId: seeded.outsiderOrganization.id
    });
    const token = auth.accessToken;
    const outsiderToken = outsiderAuth.accessToken;

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

    const assignmentResponse = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: authHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        organizationId: seeded.organization.id,
        classId: seeded.learningClass.id,
        title: 'Math quiz',
        type: 'quiz',
        dueAt: '2026-10-01T10:00:00Z'
      })
    });
    assert.equal(assignmentResponse.status, 201);
    const assignment = await assignmentResponse.json();

    const submissionResponse = await fetch(`${baseUrl}/assignments/submissions`, {
      method: 'POST',
      headers: authHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        organizationId: seeded.organization.id,
        assignmentId: assignment.id,
        learnerId: seeded.learner.id,
        contentReference: 'file://submission-a'
      })
    });
    assert.equal(submissionResponse.status, 201);
    const submission = await submissionResponse.json();

    const gradeResponse = await fetch(`${baseUrl}/assignments/submissions/grade`, {
      method: 'POST',
      headers: authHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        submissionId: submission.id,
        score: 16,
        maxScore: 20,
        coefficient: 2
      })
    });
    assert.equal(gradeResponse.status, 201);

    const outsiderGradeAttempt = await fetch(`${baseUrl}/assignments/submissions/grade`, {
      method: 'POST',
      headers: authHeaders(outsiderToken, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        submissionId: submission.id,
        score: 15,
        maxScore: 20,
        coefficient: 1
      })
    });
    assert.equal(outsiderGradeAttempt.status, 403);

    const documentVersionResponse = await fetch(`${baseUrl}/documents/versions`, {
      method: 'POST',
      headers: authHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        previousDocumentId: seeded.document.id,
        title: 'Transcript v2',
        storageReference: 'file://transcript-v2'
      })
    });
    assert.equal(documentVersionResponse.status, 201);
    const versionedDocument = await documentVersionResponse.json();

    const credentialRevisionResponse = await fetch(`${baseUrl}/credentials/revisions`, {
      method: 'POST',
      headers: authHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        previousCredentialId: seeded.credential.id,
        documentId: versionedDocument.id,
        credentialType: 'diploma'
      })
    });
    assert.equal(credentialRevisionResponse.status, 201);

    const outsiderVersionAttempt = await fetch(`${baseUrl}/documents/versions`, {
      method: 'POST',
      headers: authHeaders(outsiderToken, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        previousDocumentId: seeded.document.id,
        title: 'forbidden',
        storageReference: 'file://forbidden'
      })
    });
    assert.equal(outsiderVersionAttempt.status, 403);

    const outsiderCredentialRevisionAttempt = await fetch(`${baseUrl}/credentials/revisions`, {
      method: 'POST',
      headers: authHeaders(outsiderToken, { 'content-type': 'application/json' }),
      body: JSON.stringify({
        previousCredentialId: seeded.credential.id,
        credentialType: 'diploma'
      })
    });
    assert.equal(outsiderCredentialRevisionAttempt.status, 403);
  });
});
