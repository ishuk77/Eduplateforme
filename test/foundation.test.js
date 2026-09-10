import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEducationalRoleAssignment,
  createLearnerProfile,
  createLoginAccount,
  createPerson
} from '../src/core/domain/identity.js';
import { createEnrollmentId } from '../src/core/domain/identifiers.js';
import { createOrganization } from '../src/core/domain/organization.js';
import { createAccreditation, createAuthorization } from '../src/core/domain/access.js';
import {
  appendDocumentVersion,
  createDocument,
  createDocumentVersion
} from '../src/core/domain/documents.js';
import { createCountryConfigurationRegistry } from '../src/core/domain/country-config.js';

test('person, account, and role assignment are distinct identity objects', () => {
  const person = createPerson({ legalName: 'Ada Lovelace' });
  const account = createLoginAccount({
    personId: person.personId,
    username: 'ada',
    email: 'ada@example.org'
  });
  const roleAssignment = createEducationalRoleAssignment({
    personId: person.personId,
    organizationId: 'org-x',
    role: 'learner',
    startsOn: '2026-01-01'
  });

  assert.ok(person.personId);
  assert.ok(account.accountId);
  assert.ok(roleAssignment.roleAssignmentId);
  assert.equal(account.personId, person.personId);
  assert.equal(roleAssignment.personId, person.personId);
});

test('learner id and enrollment id remain independent identifiers', () => {
  const person = createPerson({ legalName: 'Grace Hopper' });
  const learner = createLearnerProfile({ personId: person.personId });
  const enrollmentId = createEnrollmentId();

  assert.ok(learner.learnerId);
  assert.ok(enrollmentId);
  assert.notEqual(learner.learnerId, enrollmentId);
});

test('organization identity is separate from national institution id', () => {
  const organization = createOrganization({
    tenantId: 'tenant-global',
    displayName: 'Lyceum International',
    legalName: 'Lyceum International LTD',
    nationalInstitutionId: 'MINEDU-9988',
    countryCode: 'FR'
  });

  assert.ok(organization.organizationId);
  assert.equal(organization.nationalInstitutionId, 'MINEDU-9988');
  assert.notEqual(organization.organizationId, organization.nationalInstitutionId);
});

test('authorization and accreditation are independent governance concepts', () => {
  const authorization = createAuthorization({
    organizationId: 'org-1',
    scope: 'can_issue_transcripts',
    grantedBy: 'authority-a',
    grantedAt: '2026-02-01'
  });
  const accreditation = createAccreditation({
    organizationId: 'org-1',
    framework: 'EQF',
    level: 'Level 6',
    issuedBy: 'agency-b',
    validFrom: '2026-03-01'
  });

  assert.ok(authorization.authorizationId);
  assert.ok(accreditation.accreditationId);
  assert.equal(authorization.organizationId, accreditation.organizationId);
});

test('document versions stay auditable and append-only', () => {
  const firstVersion = createDocumentVersion({
    checksum: 'sha256-v1',
    issuedAt: '2026-04-01',
    issuedBy: 'registrar'
  });
  const base = createDocument({
    ownerType: 'learner',
    ownerId: 'learner-1',
    currentVersion: firstVersion.versionId,
    versions: [firstVersion]
  });

  const secondVersion = createDocumentVersion({
    checksum: 'sha256-v2',
    issuedAt: '2026-04-05',
    issuedBy: 'registrar'
  });

  const updated = appendDocumentVersion(base, secondVersion);

  assert.equal(updated.currentVersion, secondVersion.versionId);
  assert.equal(updated.versions.length, 2);
  assert.equal(updated.versions[0].versionId, firstVersion.versionId);
  assert.equal(updated.versions[1].versionId, secondVersion.versionId);
});

test('country configuration hook supports country-specific policies', () => {
  const registry = createCountryConfigurationRegistry({
    FR: { learnerCodeFormat: /^FR-/ }
  });

  registry.set('CA', { learnerCodeFormat: /^CA-/ });

  assert.equal(registry.has('FR'), true);
  assert.equal(registry.has('CA'), true);
  assert.equal(registry.get('DE'), null);
  assert.deepEqual(registry.listCountryCodes().sort(), ['CA', 'FR']);
});
