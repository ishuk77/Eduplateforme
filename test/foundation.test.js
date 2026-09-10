import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDefaultFoundation } from '../src/application/foundation-service.js';
import { createHttpServer } from '../src/http/server.js';
import { CountryRuleRegistry } from '../src/domain/rules/country-rule-registry.js';
import { ValidationError } from '../src/shared/entity.js';

test('foundation separates organizations, people, accounts, and roles', () => {
  const foundation = createDefaultFoundation();
  const organization = foundation.createOrganization({
    legalName: 'Lycée Horizon',
    displayName: 'Horizon',
    internalReference: 'ORG-001',
    countryCode: 'SN',
    nationalIdentifiers: [{ type: 'ministry-code', value: 'SN-77' }]
  });
  const person = foundation.registerPerson({
    givenName: 'Awa',
    familyName: 'Diop',
    nationalIdentifiers: [{ countryCode: 'SN', type: 'student-number', value: 'ST-001' }]
  });
  const account = foundation.openUserAccount({
    personId: person.id,
    username: 'awa.diop',
    email: 'awa@example.edu'
  });
  const permission = foundation.createPermission({
    code: 'student.profile.read',
    description: 'Read student profile'
  });
  const role = foundation.createRole({
    code: 'student',
    name: 'Student',
    permissions: [permission.code]
  });
  const assignment = foundation.assignRole({
    personId: person.id,
    roleId: role.id,
    organizationId: organization.id
  });
  const academicYear = foundation.createAcademicYear({
    organizationId: organization.id,
    code: '2026-2027',
    name: 'Academic Year 2026-2027',
    startsOn: '2026-09-01',
    endsOn: '2027-06-30'
  });
  const program = foundation.createProgram({
    organizationId: organization.id,
    academicYearId: academicYear.id,
    code: 'SCI',
    name: 'Science program'
  });
  const learningClass = foundation.createClass({
    organizationId: organization.id,
    academicYearId: academicYear.id,
    programId: program.id,
    code: 'SCI-6A',
    name: 'Science 6A'
  });
  const enrollment = foundation.createEnrollment({
    organizationId: organization.id,
    personId: person.id,
    classId: learningClass.id,
    academicYearId: academicYear.id
  });
  const document = foundation.registerDocument({
    organizationId: organization.id,
    personId: person.id,
    type: 'report-card',
    title: 'Term 1 Report Card',
    storageReference: 'documents/report-card-1.pdf'
  });
  const credential = foundation.issueCredential({
    organizationId: organization.id,
    personId: person.id,
    documentId: document.id,
    credentialType: 'completion'
  });

  assert.match(organization.id, /^[0-9a-f-]{36}$/);
  assert.notEqual(person.id, account.id);
  assert.equal(account.personId, person.id);
  assert.equal(assignment.roleId, role.id);
  assert.equal(enrollment.classId, learningClass.id);
  assert.equal(credential.documentId, document.id);
  assert.deepEqual(foundation.summarize(), {
    organizations: 1,
    people: 1,
    accounts: 1,
    roles: 1,
    enrollments: 1,
    documents: 1,
    credentials: 1,
    events: 12
  });
});

test('foundation preserves lifecycle and country validation hooks', () => {
  const rules = new CountryRuleRegistry();
  rules.register('SN', {
    validateOrganizationIdentifier(identifier) {
      return identifier.startsWith('ORG-');
    },
    validatePersonIdentifier(identifier) {
      return identifier.startsWith('ST-');
    }
  });

  const foundation = createDefaultFoundation({ countryRules: rules });
  const organization = foundation.createOrganization({
    legalName: 'Académie Delta',
    displayName: 'Delta',
    internalReference: 'ORG-002',
    countryCode: 'SN'
  });

  organization.archive();
  foundation.recordEvent('organization.archived', organization);

  assert.equal(organization.status, 'archived');
  assert.equal(foundation.events.at(-1).type, 'organization.archived');

  assert.throws(() => {
    foundation.registerPerson({
      givenName: 'Moussa',
      familyName: 'Fall',
      nationalIdentifiers: [{ countryCode: 'SN', type: 'student-number', value: 'BAD' }]
    });
  }, ValidationError);
});

test('http server exposes foundation metadata endpoints', async () => {
  const server = createHttpServer();
  server.listen(0);
  await once(server, 'listening');

  const { port } = server.address();
  const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
  const metaResponse = await fetch(`http://127.0.0.1:${port}/meta/foundation`);

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });
  assert.equal(metaResponse.status, 200);
  assert.equal((await metaResponse.json()).scope, 'initial-foundation');

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});
