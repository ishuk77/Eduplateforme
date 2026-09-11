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
    nationalInstitutionId: 'NAT-001',
    nationalIdentifiers: [{ type: 'ministry-code', value: 'SN-77' }]
  });
  const person = foundation.registerPerson({
    givenName: 'Awa',
    familyName: 'Diop',
    primaryOrganizationId: organization.id,
    nationalIdentifiers: [{ countryCode: 'SN', type: 'student-number', value: 'ST-001' }]
  });
  const account = foundation.openUserAccount({
    personId: person.id,
    username: 'awa.diop',
    email: 'awa@example.edu',
    organizationIds: [organization.id]
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
  const grant = foundation.createPermissionGrant({
    permissionId: permission.id,
    organizationId: organization.id,
    accountId: account.id,
    reason: 'Temporary support override'
  });
  const learner = foundation.createLearner({
    organizationId: organization.id,
    personId: person.id,
    learnerNumber: 'LRN-001'
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
    learnerId: learner.id,
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
    documentNumber: 'DOC-2026-001',
    storageReference: 'documents/report-card-1.pdf'
  });
  const correctedDocument = foundation.registerDocumentVersion(document.id, {
    storageReference: 'documents/report-card-1-v2.pdf'
  });
  const credential = foundation.issueCredential({
    organizationId: organization.id,
    personId: person.id,
    documentId: correctedDocument.id,
    credentialNumber: 'CRD-2026-001',
    credentialType: 'completion'
  });
  const correctedCredential = foundation.issueCredentialRevision(credential.id, {
    documentId: correctedDocument.id
  });

  assert.match(organization.id, /^[0-9a-f-]{36}$/);
  assert.notEqual(organization.id, organization.nationalInstitutionId);
  assert.notEqual(person.id, account.id);
  assert.equal(account.personId, person.id);
  assert.equal(assignment.roleId, role.id);
  assert.equal(grant.accountId, account.id);
  assert.notEqual(learner.id, enrollment.id);
  assert.equal(enrollment.classId, learningClass.id);
  assert.equal(enrollment.learnerId, learner.id);
  assert.equal(correctedDocument.supersedesDocumentId, document.id);
  assert.equal(document.status, 'superseded');
  assert.equal(correctedCredential.supersedesCredentialId, credential.id);
  assert.equal(credential.status, 'superseded');
  assert.equal(correctedCredential.documentId, correctedDocument.id);
  assert.deepEqual(foundation.summarize(), {
    organizations: 1,
    people: 1,
    accounts: 1,
    roles: 1,
    permissionGrants: 1,
    learners: 1,
    enrollments: 1,
    documents: 2,
    credentials: 2,
    events: 16
  });
});

test('foundation preserves lifecycle and country validation hooks', () => {
  const rules = new CountryRuleRegistry();
  rules.register('SN', {
    validateOrganizationIdentifier(identifier) {
      return identifier.startsWith('ORG-');
    },
    validateNationalOrganizationIdentifier(identifier) {
      return identifier.startsWith('NAT-');
    },
    validateLocalOrganizationIdentifier(identifier) {
      return identifier.startsWith('LOC-');
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
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-002',
    localIdentifiers: [{ type: 'campus', value: 'LOC-DAKAR' }]
  });

  organization.archive();
  foundation.recordEvent('organization.archived', organization);

  assert.equal(organization.status, 'archived');
  assert.equal(foundation.events.at(-1).type, 'organization.archived');
  assert.equal(foundation.events.at(-1).sequenceNumber, 2);

  assert.throws(() => {
    foundation.registerPerson({
      givenName: 'Moussa',
      familyName: 'Fall',
      nationalIdentifiers: [{ countryCode: 'SN', type: 'student-number', value: 'BAD' }]
    });
  }, ValidationError);

  assert.throws(() => {
    foundation.createOrganization({
      legalName: 'Bad National Identifier',
      displayName: 'Bad National Identifier',
      internalReference: 'ORG-003',
      countryCode: 'SN',
      nationalInstitutionId: 'WRONG'
    });
  }, ValidationError);
});

test('foundation rejects duplicate identities and mismatched enrollments', () => {
  const foundation = createDefaultFoundation();
  const organization = foundation.createOrganization({
    legalName: 'Institut Atlas',
    displayName: 'Atlas',
    internalReference: 'ORG-003',
    countryCode: 'MA',
    nationalInstitutionId: 'NAT-ATLAS'
  });
  const person = foundation.registerPerson({
    givenName: 'Salma',
    familyName: 'Benali',
    primaryOrganizationId: organization.id,
    nationalIdentifiers: [{ countryCode: 'MA', type: 'student-number', value: 'MA-ST-01' }]
  });
  foundation.openUserAccount({
    personId: person.id,
    username: 'salma',
    email: 'salma@example.edu'
  });
  const learner = foundation.createLearner({
    organizationId: organization.id,
    personId: person.id,
    learnerNumber: 'LRN-MA-01'
  });
  const academicYear = foundation.createAcademicYear({
    organizationId: organization.id,
    code: '2026-2027',
    name: 'AY 2026-2027',
    startsOn: '2026-09-01',
    endsOn: '2027-06-30'
  });
  const program = foundation.createProgram({
    organizationId: organization.id,
    academicYearId: academicYear.id,
    code: 'MATH',
    name: 'Maths'
  });
  const learningClass = foundation.createClass({
    organizationId: organization.id,
    academicYearId: academicYear.id,
    programId: program.id,
    code: 'MATH-1',
    name: 'Math 1'
  });

  assert.throws(() => {
    foundation.registerPerson({
      givenName: 'Another',
      familyName: 'Student',
      nationalIdentifiers: [{ countryCode: 'MA', type: 'student-number', value: 'MA-ST-01' }]
    });
  }, ValidationError);

  assert.throws(() => {
    foundation.openUserAccount({
      personId: person.id,
      username: 'salma',
      email: 'other@example.edu'
    });
  }, ValidationError);

  assert.throws(() => {
    foundation.createEnrollment({
      learnerId: learner.id,
      organizationId: organization.id,
      personId: 'different-person',
      classId: learningClass.id,
      academicYearId: academicYear.id
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
  const invariantsResponse = await fetch(`http://127.0.0.1:${port}/meta/invariants`);

  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'sqlite');
  assert.ok(Number.isInteger(health.uptimeSeconds));
  assert.equal(metaResponse.status, 200);
  const meta = await metaResponse.json();
  assert.equal(meta.scope, 'full-specification-foundation');
  assert.equal(meta.summary.learners, 0);
  assert.equal(meta.summary.grades, 0);
  assert.ok(meta.invariants.includes('learner_id != enrollment_id'));
  assert.equal(invariantsResponse.status, 200);
  assert.deepEqual((await invariantsResponse.json()).invariants, meta.invariants);

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
