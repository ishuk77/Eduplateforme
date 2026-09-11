import assert from 'node:assert/strict';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function start(service) {
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))
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

async function registerTenant(baseUrl, suffix) {
  const registration = await request(baseUrl, '/auth/register', {
    method: 'POST',
    expected: 201,
    body: {
      givenName: 'Admin',
      familyName: suffix,
      username: `admin-${suffix.toLowerCase()}`,
      email: `${suffix.toLowerCase()}@example.edu`,
      password: 'correct-horse-battery'
    }
  });
  const onboarding = await request(baseUrl, '/auth/onboarding', {
    token: registration.accessToken,
    method: 'POST',
    body: {
      legalName: `Institution ${suffix}`,
      displayName: suffix,
      internalReference: `ORG-${suffix}`,
      nationalInstitutionId: `NAT-${suffix}`,
      registrationNumber: `REG-${suffix}`,
      taxIdentifier: `TAX-${suffix}`,
      administrativeAuthority: 'Ministère de l’éducation',
      operationalStatus: 'operational',
      headquartersAddress: { city: 'Dakar' },
      officialContact: { email: `contact-${suffix.toLowerCase()}@example.edu` },
      countryCode: 'SN',
      organizationType: 'school'
    }
  });
  return { token: onboarding.accessToken, organizationId: onboarding.user.organizationId };
}

test('institution regulation, profiles, curriculum and lifecycle remain tenant scoped', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = await start(service);
  try {
    const tenantA = await registerTenant(server.baseUrl, 'Alpha');
    const tenantB = await registerTenant(server.baseUrl, 'Beta');
    const organization = await request(server.baseUrl, `/organizations/${tenantA.organizationId}`, { token: tenantA.token });
    assert.notEqual(organization.id, organization.nationalInstitutionId);
    assert.notEqual(organization.id, organization.internalReference);
    assert.equal(organization.headquartersAddress.city, 'Dakar');

    const campus = await request(server.baseUrl, '/institution/campuses', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        code: 'NORTH',
        name: 'Campus Nord',
        localIdentifier: 'SITE-LOCAL-1',
        address: { city: 'Saint-Louis' }
      }
    });
    const authorization = await request(server.baseUrl, '/institution/operating-authorizations', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        type: 'school-operation',
        authority: 'Ministère',
        jurisdiction: 'SN',
        reference: 'AUTH-2026-1',
        validFrom: '2026-01-01',
        validUntil: '2028-12-31',
        scope: { campusIds: [campus.id] },
        evidenceReference: 'vault://authorization/1'
      }
    });
    const accreditation = await request(server.baseUrl, '/institution/accreditations', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        accreditationType: 'quality',
        authority: 'Agence qualité',
        jurisdiction: 'SN',
        targetType: 'site',
        targetId: campus.id,
        reference: 'ACC-2026-1'
      }
    });
    assert.notEqual(authorization.id, accreditation.id);
    assert.equal(authorization.type, 'school-operation');
    assert.equal(accreditation.targetType, 'site');

    const activeAuthorization = await request(
      server.baseUrl,
      `/institution/operating-authorizations/${authorization.id}/transition`,
      {
        token: tenantA.token,
        method: 'POST',
        body: { status: 'active', reason: 'Approved', authority: 'Ministère' }
      }
    );
    assert.equal(activeAuthorization.status, 'active');
    assert.equal(activeAuthorization.history.length, 1);
    const suspendedAuthorization = await request(
      server.baseUrl,
      `/institution/operating-authorizations/${authorization.id}/transition`,
      {
        token: tenantA.token,
        method: 'POST',
        body: { status: 'suspended', reason: 'Inspection', evidenceReference: 'vault://inspection/1' }
      }
    );
    assert.equal(suspendedAuthorization.history.length, 2);

    const verification = await request(server.baseUrl, '/institution/verifications', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        publicCode: 'VERIFY-A',
        evidenceReference: 'vault://private/verification',
        publicNote: 'Établissement reconnu'
      }
    });
    await request(server.baseUrl, `/institution/verifications/${verification.id}/transition`, {
      token: tenantA.token,
      method: 'POST',
      body: { status: 'PENDING_VERIFICATION' }
    });
    await request(server.baseUrl, `/institution/verifications/${verification.id}/transition`, {
      token: tenantA.token,
      method: 'POST',
      body: { status: 'VERIFIED_BY_AUTHORITY', authority: 'Ministère' }
    });
    const publicRecord = await request(server.baseUrl, '/public/institutions/verify/VERIFY-A');
    assert.equal(publicRecord.status, 'VERIFIED_BY_AUTHORITY');
    assert.equal(publicRecord.institution.displayName, 'Alpha');
    assert.equal('organizationId' in publicRecord, false);
    assert.equal('evidenceReference' in publicRecord, false);
    assert.equal('registrationNumber' in publicRecord.institution, false);
    assert.equal('taxIdentifier' in publicRecord.institution, false);

    const learnerPerson = await request(server.baseUrl, '/people', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, primaryOrganizationId: tenantA.organizationId, givenName: 'Lea', familyName: 'Learner' }
    });
    const guardianPerson = await request(server.baseUrl, '/people', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, primaryOrganizationId: tenantA.organizationId, givenName: 'Gina', familyName: 'Guardian' }
    });
    const teacherPerson = await request(server.baseUrl, '/people', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, primaryOrganizationId: tenantA.organizationId, givenName: 'Theo', familyName: 'Teacher' }
    });
    const learner = await request(server.baseUrl, '/academics/learners', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, personId: learnerPerson.id, learnerNumber: 'LRN-A' }
    });
    const guardian = await request(server.baseUrl, '/profiles/guardians', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, personId: guardianPerson.id, relationshipTypes: ['parent'] }
    });
    const relation = await request(server.baseUrl, '/profiles/guardian-relations', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        guardianProfileId: guardian.id,
        learnerId: learner.id,
        relationship: 'mother',
        permissions: ['academic.read', 'attendance.read']
      }
    });
    const withdrawn = await request(server.baseUrl, `/profiles/guardian-relations/${relation.id}/withdraw`, {
      token: tenantA.token,
      method: 'POST',
      body: { reason: 'Mandate ended' }
    });
    assert.equal(withdrawn.status, 'withdrawn');

    const professional = await request(server.baseUrl, '/profiles/professionals', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        personId: teacherPerson.id,
        professionalType: 'teacher',
        specialties: ['mathematics'],
        qualifications: [{ title: 'M.Ed.' }],
        availability: { monday: ['08:00-12:00'] }
      }
    });
    const assignmentA = await request(server.baseUrl, '/profiles/professional-assignments', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        professionalProfileId: professional.id,
        campusId: campus.id,
        roleTitle: 'Math teacher',
        startsOn: '2026-09-01'
      }
    });
    assert.equal(assignmentA.organizationId, tenantA.organizationId);
    await request(server.baseUrl, `/profiles/professionals/${professional.id}`, {
      token: tenantA.token,
      method: 'PUT',
      body: { assignmentOrganizationIds: [tenantA.organizationId, tenantB.organizationId] }
    });
    const assignmentB = await request(server.baseUrl, '/profiles/professional-assignments', {
      token: tenantB.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantB.organizationId,
        professionalProfileId: professional.id,
        roleTitle: 'Visiting teacher',
        startsOn: '2026-10-01'
      }
    });
    assert.equal(assignmentB.organizationId, tenantB.organizationId);

    const year = await request(server.baseUrl, '/academics/years', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, code: '2026', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30' }
    });
    const period = await request(server.baseUrl, '/academics/periods', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, academicYearId: year.id, periodType: 'semester', code: 'S1', name: 'Semestre 1', startsOn: '2026-09-01', endsOn: '2027-01-31' }
    });
    const level = await request(server.baseUrl, '/academics/levels', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, code: 'L1', name: 'Niveau 1', specialization: 'Sciences', creditsRequired: 30 }
    });
    assert.equal(level.creditsRequired, 30);
    const program = await request(server.baseUrl, '/academics/programs', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, academicYearId: year.id, code: 'SCI', name: 'Sciences' }
    });
    const learningClass = await request(server.baseUrl, '/academics/classes', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, academicYearId: year.id, programId: program.id, campusId: campus.id, code: 'SCI-1', name: 'Sciences 1', levelCode: level.code }
    });
    const subject = await request(server.baseUrl, '/academics/subjects', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: tenantA.organizationId, code: 'MATH', name: 'Mathématiques', defaultCredits: 4 }
    });
    const course = await request(server.baseUrl, '/academics/courses', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        subjectId: subject.id,
        academicPeriodId: period.id,
        classId: learningClass.id,
        programId: program.id,
        code: 'MATH-S1',
        name: 'Mathématiques S1',
        teacherAssignmentIds: [assignmentA.id],
        credits: 4
      }
    });
    assert.notEqual(course.id, subject.id);
    assert.equal(course.subjectId, subject.id);

    const lifecycle = await request(server.baseUrl, '/academics/lifecycle-events', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        learnerId: learner.id,
        eventType: 'admission',
        previousContext: {},
        newContext: { programId: program.id, classId: learningClass.id },
        reason: 'Admission committee approval',
        evidenceReference: 'vault://admission/1',
        authority: 'Registrar'
      }
    });
    assert.equal(lifecycle.eventType, 'admission');
    assert.equal((await request(server.baseUrl, `/academics/learners/${learner.id}`, { token: tenantA.token })).status, 'admission');
    await request(server.baseUrl, `/academics/lifecycle-events/${lifecycle.id}`, {
      token: tenantA.token,
      method: 'PUT',
      expected: 404,
      body: { eventType: 'graduation' }
    });
    await request(server.baseUrl, `/institution/operating-authorizations/${authorization.id}`, {
      token: tenantA.token,
      method: 'PUT',
      expected: 400,
      body: { status: 'revoked' }
    });

    await request(server.baseUrl, `/institution/campuses/${campus.id}`, {
      token: tenantB.token,
      expected: 403
    });
    await request(server.baseUrl, '/academics/courses', {
      token: tenantB.token,
      method: 'POST',
      expected: 400,
      body: {
        organizationId: tenantB.organizationId,
        subjectId: subject.id,
        academicPeriodId: period.id,
        classId: learningClass.id,
        code: 'FORBIDDEN',
        name: 'Forbidden'
      }
    });

    const rule = await request(server.baseUrl, '/security/contextual-permissions', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        roleCode: 'tenant-admin',
        resource: 'academics',
        action: 'write',
        scopeType: 'class',
        scopeId: learningClass.id,
        effect: 'allow'
      }
    });
    assert.equal(rule.scopeType, 'class');
    await request(server.baseUrl, '/security/contextual-permissions', {
      token: tenantA.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: tenantA.organizationId,
        roleCode: 'tenant-admin',
        resource: 'academics',
        action: 'write',
        scopeType: 'class',
        scopeId: learningClass.id,
        effect: 'deny'
      }
    });
    await request(server.baseUrl, '/academics/courses', {
      token: tenantA.token,
      method: 'POST',
      expected: 403,
      body: {
        organizationId: tenantA.organizationId,
        subjectId: subject.id,
        academicPeriodId: period.id,
        classId: learningClass.id,
        code: 'DENIED',
        name: 'Denied by contextual policy'
      }
    });
  } finally {
    await server.close();
    await service.close();
  }
});

test('new institutional collections persist through the PostgreSQL async path', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const connection = await createPostgresConnection('postgresql://memory/institutional', { Pool });
  const service = await initializePersistentEducationPlatformService({ connection });
  try {
    const organization = await service.createOrganization({
      legalName: 'Async Institution',
      displayName: 'Async',
      internalReference: 'ASYNC-INST',
      countryCode: 'SN'
    }, 'bootstrap');
    const campus = await service.createCampus({
      organizationId: organization.id,
      code: 'ASYNC-CAMPUS',
      name: 'Campus Async'
    }, 'bootstrap');
    const authorization = await service.createOperatingAuthorization({
      organizationId: organization.id,
      type: 'operation',
      authority: 'Authority',
      jurisdiction: 'SN',
      reference: 'ASYNC-AUTH'
    }, 'bootstrap');
    const transitioned = await service.transitionInstitutionalStatus(
      'operatingAuthorizations',
      authorization.id,
      { status: 'active', reason: 'Approved' },
      'bootstrap'
    );
    assert.equal(transitioned.status, 'active');
    assert.equal((await service.repositories.campuses.get(campus.id)).name, 'Campus Async');
    assert.equal((await service.repositories.operatingAuthorizations.history(authorization.id)).page.total, 2);

    const concurrentAuthorization = await service.createOperatingAuthorization({
      organizationId: organization.id,
      type: 'operation',
      authority: 'Authority',
      jurisdiction: 'SN',
      reference: 'ASYNC-AUTH-CONCURRENT'
    }, 'bootstrap');
    const transitions = await Promise.allSettled([
      service.transitionInstitutionalStatus(
        'operatingAuthorizations',
        concurrentAuthorization.id,
        { status: 'active' },
        'bootstrap'
      ),
      service.transitionInstitutionalStatus(
        'operatingAuthorizations',
        concurrentAuthorization.id,
        { status: 'pending' },
        'bootstrap'
      )
    ]);
    assert.equal(transitions.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(transitions.filter(({ status }) => status === 'rejected').length, 1);
  } finally {
    await service.close();
  }
});
