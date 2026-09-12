import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createApp } from '../../src/http/app.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function seedAcademicTenant(service, suffix) {
  const organization = await service.createOrganization({
    legalName: `Institution ${suffix}`,
    displayName: `Institution ${suffix}`,
    internalReference: `ORG-${suffix}`,
    countryCode: 'SN'
  }, 'bootstrap');
  const year = await service.createAcademicYear({
    organizationId: organization.id,
    code: `2026-${suffix}`,
    name: '2026-2027',
    startsOn: '2026-09-01',
    endsOn: '2027-06-30'
  }, 'bootstrap');
  const program = await service.createProgram({
    organizationId: organization.id,
    academicYearId: year.id,
    code: `PROGRAM-${suffix}`,
    name: 'Programme'
  }, 'bootstrap');
  const learningClass = await service.createClass({
    organizationId: organization.id,
    academicYearId: year.id,
    programId: program.id,
    code: `CLASS-${suffix}`,
    name: 'Classe A'
  }, 'bootstrap');
  const period = await service.createAcademicPeriod({
    organizationId: organization.id,
    academicYearId: year.id,
    periodType: 'semester',
    sequence: 1,
    code: `S1-${suffix}`,
    name: 'Semestre 1',
    startsOn: '2026-09-01',
    endsOn: '2027-01-31'
  }, 'bootstrap');
  const subject = await service.createSubject({
    organizationId: organization.id,
    code: `MAT-${suffix}`,
    name: 'Mathématiques'
  }, 'bootstrap');
  const course = await service.createCourse({
    organizationId: organization.id,
    subjectId: subject.id,
    academicPeriodId: period.id,
    classId: learningClass.id,
    code: `COURSE-${suffix}`,
    name: 'Algèbre'
  }, 'bootstrap');
  return { organization, year, program, learningClass, course };
}

async function addLearner(service, context, suffix, status = 'active') {
  const person = await service.registerPerson({
    givenName: `Learner ${suffix}`,
    familyName: 'Test',
    primaryOrganizationId: context.organization.id
  }, 'bootstrap');
  const learner = await service.createLearner({
    organizationId: context.organization.id,
    personId: person.id,
    learnerNumber: `LRN-${suffix}`
  }, 'bootstrap');
  await service.createEnrollment({
    organizationId: context.organization.id,
    learnerId: learner.id,
    personId: person.id,
    classId: context.learningClass.id,
    academicYearId: context.year.id,
    programId: context.program.id,
    status
  }, 'bootstrap');
  return { person, learner };
}

test('landing exposes only Connexion and Créer un compte access actions', async () => {
  const source = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
  const landingSource = source.slice(source.indexOf('function landing()'), source.indexOf('function onboarding()'));
  assert.match(landingSource, />Connexion</);
  assert.match(landingSource, />Créer un compte</);
  assert.doesNotMatch(landingSource, /Créer mon compte administrateur|J’ai déjà un compte|Vérifier une institution|Vérifier un diplôme/);
  assert.equal((landingSource.match(/href="\/(login|register)"/g) ?? []).length, 2);
});

test('custom domains normalize, remain unique, verify ownership, resolve hosts and audit governance', async () => {
  const service = createPersistentEducationPlatformService({
    databaseUrl: 'sqlite::memory:',
    domainVerifier: async (domain, token) => domain === 'school.example.edu' && token.length > 20
  });

  try {
    const first = await seedAcademicTenant(service, 'DOMAIN-A');
    const second = await seedAcademicTenant(service, 'DOMAIN-B');
    const configured = await service.configureCustomDomain({
      organizationId: first.organization.id,
      domain: 'HTTPS://School.Example.EDU/'
    }, 'tenant-admin');
    assert.equal(configured.domain, 'school.example.edu');
    assert.equal(configured.verificationState, 'pending');
    assert.equal(configured.instructions.recordType, 'TXT');
    await assert.rejects(service.configureCustomDomain({
      organizationId: second.organization.id,
      domain: 'school.example.edu'
    }, 'other-admin'), /already associated/);

    const verified = await service.verifyCustomDomain(configured.id, 'tenant-admin');
    assert.equal(verified.verificationState, 'verified');
    assert.equal(service.resolveVerifiedTenantByHost('school.example.edu').organizationId, first.organization.id);
    await service.governCustomDomain(configured.id, { accessState: 'suspended', problem: 'Subscription review' }, 'platform-admin');
    assert.equal(service.resolveVerifiedTenantByHost('school.example.edu'), null);
    await service.governCustomDomain(configured.id, { accessState: 'active', problem: null }, 'platform-admin');
    assert.equal(service.resolveVerifiedTenantByHost('school.example.edu').organizationId, first.organization.id);
    const subscription = await service.createPlatformSubscription({
      organizationId: first.organization.id,
      plan: 'standard',
      startsOn: '2026-09-01'
    }, 'tenant-admin');
    await service.governPlatformSubscription(subscription.id, { status: 'suspended' }, 'platform-admin');
    assert.equal(service.platformSubscriptions.get(subscription.id).status, 'suspended');
    const audits = service.connection.all(
      "SELECT action FROM audit_trail WHERE entity_id IN (?, ?) ORDER BY created_at",
      [configured.id, subscription.id]
    );
    assert.ok(audits.some((entry) => entry.action === 'platform.custom-domain.govern'));
    assert.ok(audits.some((entry) => entry.action === 'platform.subscription.govern'));
  } finally {
    await service.close();
  }
});

test('verified hosts bind authenticated traffic to one tenant and suspended hosts stop serving', async () => {
  const service = createPersistentEducationPlatformService({
    databaseUrl: 'sqlite::memory:',
    domainVerifier: async () => true
  });
  try {
    const firstRegistration = await service.registerUser({
      givenName: 'Host',
      familyName: 'Owner',
      username: 'host-owner',
      email: 'host-owner@example.edu',
      password: 'correct-horse-battery'
    });
    const first = await service.onboardAccount(firstRegistration.account.id, {
      legalName: 'Host School',
      displayName: 'Host School',
      countryCode: 'SN',
      organizationType: 'school'
    });
    const secondRegistration = await service.registerUser({
      givenName: 'Other',
      familyName: 'Owner',
      username: 'other-owner',
      email: 'other-owner@example.edu',
      password: 'correct-horse-battery'
    });
    const second = await service.onboardAccount(secondRegistration.account.id, {
      legalName: 'Other School',
      displayName: 'Other School',
      countryCode: 'SN',
      organizationType: 'school'
    });
    const domain = await service.configureCustomDomain({
      organizationId: first.organization.id,
      domain: 'tenant.example.edu'
    }, first.account.id);
    await service.verifyCustomDomain(domain.id, first.account.id);
    const firstSession = await service.createAuthenticationSession(first.account, first.organization.id);
    const secondSession = await service.createAuthenticationSession(second.account, second.organization.id);
    const app = createApp({ foundation: service });

    const allowed = await app(new Request('https://tenant.example.edu/auth/me', {
      headers: { authorization: `Bearer ${firstSession.accessToken}` }
    }));
    assert.equal(allowed.status, 200);
    const forbidden = await app(new Request('https://tenant.example.edu/auth/me', {
      headers: { authorization: `Bearer ${secondSession.accessToken}` }
    }));
    assert.equal(forbidden.status, 403);

    await service.governCustomDomain(domain.id, { accessState: 'suspended' }, 'platform-admin');
    const suspended = await app(new Request('https://tenant.example.edu/'));
    assert.equal(suspended.status, 403);
    const shared = await app(new Request('https://eduplateforme-yrgs.onrender.com/'));
    assert.equal(shared.status, 200);
  } finally {
    await service.close();
  }
});

test('assignment publishing snapshots active class recipients and learner visibility stays tenant scoped', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const first = await seedAcademicTenant(service, 'ASSIGN-A');
    const second = await seedAcademicTenant(service, 'ASSIGN-B');
    const active = await addLearner(service, first, 'ACTIVE');
    await addLearner(service, first, 'WITHDRAWN', 'withdrawn');
    const outsider = await addLearner(service, second, 'OUTSIDE');
    const assignment = await service.createAssignment({
      organizationId: first.organization.id,
      classId: first.learningClass.id,
      courseId: first.course.id,
      title: 'Devoir collectif',
      dueAt: '2026-10-01T12:00:00Z'
    }, 'teacher');
    assert.equal(assignment.status, 'draft');
    const published = await service.publishAssignment(assignment.id, 'teacher');
    assert.deepEqual(published.recipientLearnerIds, [active.learner.id]);
    assert.equal((await service.publishAssignment(assignment.id, 'teacher')).recipientLearnerIds.length, 1);
    assert.throws(() => service.updateCrudResource('assignments', assignment.id, {
      recipientLearnerIds: [outsider.learner.id]
    }, 'teacher'), /publish workflow/);
    assert.equal(service.listVisibleAssignments({
      organizationId: first.organization.id,
      learnerId: active.learner.id
    }).items.length, 1);
    assert.equal(service.listVisibleAssignments({
      organizationId: second.organization.id,
      learnerId: outsider.learner.id
    }).items.length, 0);
  } finally {
    await service.close();
  }
});

test('attendance roster validates one status per active participant and transactionally upserts', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const context = await seedAcademicTenant(service, 'ATTEND');
    const first = await addLearner(service, context, 'ONE');
    const second = await addLearner(service, context, 'TWO');
    const roster = service.getAttendanceRoster({
      organizationId: context.organization.id,
      classId: context.learningClass.id,
      courseId: context.course.id,
      date: '2026-09-12'
    });
    assert.equal(roster.participants.length, 2);
    assert.throws(() => service.saveAttendanceRoster({
      organizationId: context.organization.id,
      classId: context.learningClass.id,
      courseId: context.course.id,
      date: '2026-09-12',
      entries: [{ learnerId: first.learner.id, status: 'present' }]
    }, 'teacher'), /every active participant/);
    await service.saveAttendanceRoster({
      organizationId: context.organization.id,
      classId: context.learningClass.id,
      courseId: context.course.id,
      date: '2026-09-12',
      entries: [
        { learnerId: first.learner.id, status: 'present' },
        { learnerId: second.learner.id, status: 'unexcused' }
      ]
    }, 'teacher');
    await service.saveAttendanceRoster({
      organizationId: context.organization.id,
      classId: context.learningClass.id,
      courseId: context.course.id,
      date: '2026-09-12',
      entries: [
        { learnerId: first.learner.id, status: 'late' },
        { learnerId: second.learner.id, status: 'excused' }
      ]
    }, 'teacher');
    assert.equal(service.attendance.size, 2);
    assert.deepEqual(Array.from(service.attendance.values()).map((entry) => entry.status).sort(), ['excused', 'late']);
  } finally {
    await service.close();
  }
});

test('learner gradebook groups assessment details by course without other learners', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const context = await seedAcademicTenant(service, 'GRADE');
    const first = await addLearner(service, context, 'GRADE-ONE');
    const second = await addLearner(service, context, 'GRADE-TWO');
    const assignment = await service.createAssignment({
      organizationId: context.organization.id,
      classId: context.learningClass.id,
      courseId: context.course.id,
      title: 'Contrôle algèbre',
      dueAt: '2026-10-10T10:00:00Z'
    }, 'teacher');
    await service.publishAssignment(assignment.id, 'teacher');
    await service.recordGrade({ organizationId: context.organization.id, learnerId: first.learner.id, assignmentId: assignment.id, score: 16, maxScore: 20, coefficient: 2 }, 'teacher');
    await service.recordGrade({ organizationId: context.organization.id, learnerId: second.learner.id, assignmentId: assignment.id, score: 8, maxScore: 20, coefficient: 2 }, 'teacher');
    const gradebook = service.getLearnerGradebook({ organizationId: context.organization.id, learnerId: first.learner.id });
    assert.equal(gradebook.courses[0].courseName, 'Algèbre');
    assert.equal(gradebook.courses[0].assessments[0].score, 16);
    assert.equal(gradebook.courses[0].summary.averageOn20, 16);
    assert.doesNotMatch(JSON.stringify(gradebook), new RegExp(second.learner.id));
  } finally {
    await service.close();
  }
});

test('custom-domain state persists through PostgreSQL async repositories', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const databaseUrl = 'postgresql://memory/custom-domains';
  const firstConnection = await createPostgresConnection(databaseUrl, { Pool });
  const first = await initializePersistentEducationPlatformService({
    connection: firstConnection,
    domainVerifier: async () => true
  });
  const tenant = await seedAcademicTenant(first, 'PG-DOMAIN');
  const domain = await first.configureCustomDomain({
    organizationId: tenant.organization.id,
    domain: 'pg.example.edu'
  }, 'tenant-admin');
  await first.verifyCustomDomain(domain.id, 'tenant-admin');
  await first.close();

  const secondConnection = await createPostgresConnection(databaseUrl, { Pool });
  const second = await initializePersistentEducationPlatformService({ connection: secondConnection });
  try {
    assert.equal(second.resolveVerifiedTenantByHost('pg.example.edu').organizationId, tenant.organization.id);
  } finally {
    await second.close();
  }
});
