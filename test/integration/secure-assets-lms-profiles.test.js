import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF');

async function createTenant(service, suffix) {
  const { account, person } = await service.registerUser({
    givenName: 'Admin',
    familyName: suffix,
    username: `assets-${suffix}`,
    email: `assets-${suffix}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(account.id, {
    legalName: `Institution ${suffix}`,
    displayName: suffix,
    internalReference: `ASSET-${suffix}`,
    countryCode: 'SN',
    organizationType: 'training-center'
  });
  const session = await service.createAuthenticationSession(account, onboarding.organization.id);
  return { ...onboarding, account, person, token: session.accessToken };
}

async function startPlatform() {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    service,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await service.close();
    }
  };
}

async function jsonRequest(baseUrl, path, token, { method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: ['Bearer', token].join(' '),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

test('logo, signature, and proof uploads validate content, hash bytes, audit status, and block cross-tenant download', async () => {
  const platform = await startPlatform();
  try {
    const first = await createTenant(platform.service, 'one');
    const second = await createTenant(platform.service, 'two');
    const common = {
      fileName: '../institution.png',
      mimeType: 'image/png',
      contentBase64: PNG.toString('base64')
    };
    const logoForm = new FormData();
    logoForm.append('file', new Blob([PNG], { type: 'image/png' }), '../institution.png');
    logoForm.append('altText', 'Institution logo');
    const logoResponse = await fetch(`${platform.baseUrl}/organizations/${first.organization.id}/branding/logo`, {
      method: 'POST',
      headers: { authorization: ['Bearer', first.token].join(' ') },
      body: logoForm
    });
    assert.equal(logoResponse.status, 201);
    const logo = await logoResponse.json();
    assert.equal(logo.sha256, createHash('sha256').update(PNG).digest('hex'));
    assert.equal(logo.fileName, 'institution.png');
    const publicLogo = await fetch(`${platform.baseUrl}/public/organizations/${first.organization.id}/logo`);
    assert.equal(publicLogo.status, 200);
    assert.deepEqual(Buffer.from(await publicLogo.arrayBuffer()), PNG);

    const viewerPerson = await platform.service.registerPerson({
      primaryOrganizationId: first.organization.id,
      givenName: 'Records',
      familyName: 'Viewer'
    }, first.account.id);
    const viewerAccount = await platform.service.openUserAccount({
      personId: viewerPerson.id,
      username: 'records-viewer',
      email: 'records-viewer@example.edu',
      password: 'correct-horse-battery',
      organizationIds: [first.organization.id]
    }, first.account.id);
    const viewerRole = await platform.service.createRole({
      code: 'records-viewer',
      name: 'Records viewer',
      permissions: ['documents.read', 'credentials.read', 'people.read', 'profiles.read']
    }, first.account.id);
    await platform.service.assignRole({
      personId: viewerPerson.id,
      roleId: viewerRole.id,
      organizationId: first.organization.id
    }, first.account.id);
    const viewerSession = await platform.service.createAuthenticationSession(viewerAccount, first.organization.id);
    await jsonRequest(platform.baseUrl, '/signatures', viewerSession.accessToken, {
      method: 'POST',
      body: {
        ...common,
        organizationId: first.organization.id,
        personId: viewerPerson.id,
        function: 'Viewer',
        purpose: 'Unauthorized signature'
      },
      expected: 403
    });

    const signature = await jsonRequest(platform.baseUrl, '/signatures', first.token, {
      method: 'POST',
      body: {
        ...common,
        organizationId: first.organization.id,
        personId: first.person.id,
        function: 'Director',
        purpose: 'Course titles'
      },
      expected: 201
    });
    assert.equal(signature.legalAssurance, 'visual-mark-only');
    await jsonRequest(platform.baseUrl, `/signatures/${signature.id}/revoke`, first.token, {
      method: 'POST',
      body: { reason: 'Authority changed' }
    });

    const evidence = await jsonRequest(platform.baseUrl, '/documents/evidence', first.token, {
      method: 'POST',
      body: {
        organizationId: first.organization.id,
        personId: first.person.id,
        type: 'receipt',
        title: 'Paid receipt',
        fileName: '../../receipt.pdf',
        mimeType: 'application/pdf',
        contentBase64: PDF.toString('base64')
      },
      expected: 201
    });
    assert.equal(evidence.fileHash, createHash('sha256').update(PDF).digest('hex'));
    assert.equal(evidence.metadata.fileName, 'receipt.pdf');
    assert.equal(evidence.metadata.verification.status, 'pending');
    await jsonRequest(platform.baseUrl, `/documents/${evidence.id}/verification`, first.token, {
      method: 'POST',
      body: { status: 'verified' }
    });
    const uploaderPerson = await platform.service.registerPerson({
      primaryOrganizationId: first.organization.id,
      givenName: 'Proof',
      familyName: 'Uploader'
    }, first.account.id);
    const uploaderAccount = await platform.service.openUserAccount({
      personId: uploaderPerson.id,
      username: 'proof-uploader',
      email: 'proof-uploader@example.edu',
      password: 'correct-horse-battery',
      organizationIds: [first.organization.id]
    }, first.account.id);
    const uploaderRole = await platform.service.createRole({
      code: 'proof-uploader',
      name: 'Proof uploader',
      permissions: ['documents.read', 'documents.write']
    }, first.account.id);
    await platform.service.assignRole({
      personId: uploaderPerson.id,
      roleId: uploaderRole.id,
      organizationId: first.organization.id
    }, first.account.id);
    const uploaderSession = await platform.service.createAuthenticationSession(uploaderAccount, first.organization.id);
    await jsonRequest(platform.baseUrl, `/documents/${evidence.id}/verification`, uploaderSession.accessToken, {
      method: 'POST',
      body: { status: 'expired' },
      expected: 403
    });
    const crossTenant = await fetch(`${platform.baseUrl}/documents/${evidence.id}/content`, {
      headers: { authorization: ['Bearer', second.token].join(' ') }
    });
    assert.equal(crossTenant.status, 403);
    const wrongHolder = await fetch(`${platform.baseUrl}/documents/${evidence.id}/content`, {
      headers: { authorization: ['Bearer', viewerSession.accessToken].join(' ') }
    });
    assert.equal(wrongHolder.status, 403);
    const download = await fetch(`${platform.baseUrl}/documents/${evidence.id}/content`, {
      headers: { authorization: ['Bearer', first.token].join(' ') }
    });
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), PDF);

    await jsonRequest(platform.baseUrl, '/documents/evidence', first.token, {
      method: 'POST',
      body: {
        organizationId: first.organization.id,
        personId: first.person.id,
        type: 'receipt',
        title: 'Spoofed',
        fileName: 'spoofed.png',
        mimeType: 'image/png',
        contentBase64: Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')
      },
      expected: 400
    });
  } finally {
    await platform.close();
  }
});

test('profile self-service cannot change official identity or roles and protects optional private data', async () => {
  const platform = await startPlatform();
  try {
    const tenant = await createTenant(platform.service, 'profile');
    const profile = await jsonRequest(platform.baseUrl, '/profile/me', tenant.token);
    assert.equal(profile.givenName, 'Admin');
    await jsonRequest(platform.baseUrl, '/profile/me', tenant.token, {
      method: 'PUT',
      body: { givenName: 'Escalated', roles: ['platform-admin'] },
      expected: 400
    });
    const updated = await jsonRequest(platform.baseUrl, '/profile/me', tenant.token, {
      method: 'PUT',
      body: {
        preferredName: 'A.',
        preferredLocale: 'ar',
        countryCode: 'SN',
        timezone: 'Africa/Dakar',
        contacts: [{ type: 'email', value: 'private@example.edu', isPrimary: true, verifiedAt: new Date().toISOString() }],
        accessibility: { reducedMotion: true },
        notifications: { email: false },
        emergencyContact: { name: 'Relative', phone: '+221000000000' },
        privacyConsent: true
      }
    });
    assert.equal(updated.preferredLocale, 'ar');
    assert.equal(updated.emergencyContact.name, 'Relative');
    assert.equal(updated.contacts[0].verifiedAt, null);
    assert.ok(updated.roles.length > 0);

    const other = await platform.service.registerPerson({
      primaryOrganizationId: tenant.organization.id,
      givenName: 'Other',
      familyName: 'Person'
    }, tenant.account.id);
    const masked = platform.service.getPersonProfile(tenant.person.id, tenant.organization.id);
    assert.equal(masked.emergencyContact, null);
    assert.equal(masked.contacts[0].value, '[masked]');
    await jsonRequest(platform.baseUrl, `/people/${other.id}/profile`, tenant.token, {
      method: 'PUT',
      body: { givenName: 'Official', familyName: 'Record' }
    });
    assert.equal(platform.service.people.get(other.id).givenName, 'Official');
    platform.service.people.get(other.id).status = 'archived';
    assert.throws(
      () => platform.service.updatePersonProfile(other.id, tenant.organization.id, { preferredName: 'Resurrected' }, {
        actorId: tenant.account.id
      }),
      /Archived person/
    );
  } finally {
    await platform.close();
  }
});

async function createLmsPath(service, tenant) {
  const organizationId = tenant.organization.id;
  const actorId = tenant.account.id;
  const year = await service.createAcademicYear({
    organizationId, code: 'Y-LMS', name: 'Year', startsOn: '2026-01-01', endsOn: '2026-12-31'
  }, actorId);
  const academicProgram = await service.createProgram({
    organizationId, academicYearId: year.id, code: 'P-LMS', name: 'Program'
  }, actorId);
  const period = await service.createAcademicPeriod({
    organizationId, academicYearId: year.id, periodType: 'semester', code: 'S1',
    name: 'Semester', startsOn: '2026-01-01', endsOn: '2026-06-30'
  }, actorId);
  const subject = await service.createSubject({ organizationId, code: 'SUB', name: 'Subject' }, actorId);
  const academicCourse = await service.createCourse({
    organizationId, subjectId: subject.id, academicPeriodId: period.id,
    programId: academicProgram.id, code: 'COURSE', name: 'Course'
  }, actorId);
  const catalog = await service.createPlatformRecord('lmsCatalogs', { organizationId, code: 'CAT', name: 'Catalog' }, actorId);
  const program = await service.createPlatformRecord('lmsPrograms', {
    organizationId, catalogId: catalog.id, academicProgramId: academicProgram.id, code: 'PATH', title: 'Path'
  }, actorId);
  const course = await service.createPlatformRecord('lmsCourses', {
    organizationId, programId: program.id, academicCourseId: academicCourse.id, code: 'ONLINE', title: 'Online'
  }, actorId);
  const chapter = await service.createPlatformRecord('lmsModules', {
    organizationId, courseId: course.id, title: 'Chapter', position: 1
  }, actorId);
  const lessonOne = await service.createPlatformRecord('lmsLessons', {
    organizationId, moduleId: chapter.id, title: 'First', position: 1
  }, actorId);
  const lessonTwo = await service.createPlatformRecord('lmsLessons', {
    organizationId, moduleId: chapter.id, title: 'Second', position: 2, prerequisiteLessonId: lessonOne.id
  }, actorId);
  const participant = await service.createPlatformRecord('lmsParticipants', {
    organizationId, personId: tenant.person.id, role: 'learner'
  }, actorId);
  const enrollment = await service.createPlatformRecord('lmsEnrollments', {
    organizationId, participantId: participant.id, programId: program.id
  }, actorId);
  return { academicProgram, program, course, lessonOne, lessonTwo, enrollment };
}

test('LMS progression rejects bypass, enforces attempts and final exam, then issues one idempotent title', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'sequence');
    const path = await createLmsPath(service, tenant);
    await assert.rejects(
      service.completeLmsLesson({
        organizationId: tenant.organization.id,
        enrollmentId: path.enrollment.id,
        lessonId: path.lessonTwo.id
      }, tenant.account.id),
      /locked/
    );
    const lessonQuiz = await service.createPlatformRecord('lmsQuizzes', {
      organizationId: tenant.organization.id,
      courseId: path.course.id,
      lessonId: path.lessonOne.id,
      title: 'Checkpoint',
      passingScore: 50,
      maxAttempts: 2,
      examType: 'lesson'
    }, tenant.account.id);
    const question = await service.createPlatformRecord('lmsQuestions', {
      organizationId: tenant.organization.id,
      quizId: lessonQuiz.id,
      prompt: 'Ready?', questionType: 'single', correctAnswer: 'yes'
    }, tenant.account.id);
    await service.submitLmsQuizAttempt({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      quizId: lessonQuiz.id,
      answers: { [question.id]: 'no' }
    }, tenant.account.id);
    await assert.rejects(
      service.completeLmsLesson({
        organizationId: tenant.organization.id,
        enrollmentId: path.enrollment.id,
        lessonId: path.lessonOne.id
      }, tenant.account.id),
      /Pass the required quiz/
    );
    await service.submitLmsQuizAttempt({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      quizId: lessonQuiz.id,
      answers: { [question.id]: 'yes' }
    }, tenant.account.id);
    await assert.rejects(
      service.submitLmsQuizAttempt({
        organizationId: tenant.organization.id,
        enrollmentId: path.enrollment.id,
        quizId: lessonQuiz.id,
        answers: { [question.id]: 'yes' }
      }, tenant.account.id),
      /Maximum quiz attempts/
    );
    await service.completeLmsLesson({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      lessonId: path.lessonOne.id
    }, tenant.account.id);
    await service.completeLmsLesson({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      lessonId: path.lessonTwo.id
    }, tenant.account.id);
    const finalQuiz = await service.createPlatformRecord('lmsQuizzes', {
      organizationId: tenant.organization.id,
      courseId: path.course.id,
      title: 'Final exam',
      passingScore: 70,
      maxAttempts: 1,
      examType: 'final'
    }, tenant.account.id);
    const finalQuestion = await service.createPlatformRecord('lmsQuestions', {
      organizationId: tenant.organization.id,
      quizId: finalQuiz.id,
      prompt: 'Final?', questionType: 'single', correctAnswer: true
    }, tenant.account.id);
    await assert.rejects(
      async () => service.issueLmsTitle({
        organizationId: tenant.organization.id,
        enrollmentId: path.enrollment.id,
        titleType: 'certificate'
      }, tenant.account.id),
      /final exams/
    );
    await service.submitLmsQuizAttempt({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      quizId: finalQuiz.id,
      answers: { [finalQuestion.id]: true }
    }, tenant.account.id);
    const signature = await service.createManagedSignature({
      organizationId: tenant.organization.id,
      personId: tenant.person.id,
      function: 'Training director',
      purpose: 'Course titles',
      fileName: 'signature.png',
      mimeType: 'image/png',
      contentBase64: PNG.toString('base64')
    }, tenant.account.id);
    const issued = await service.issueLmsTitle({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      titleType: 'certificate',
      signatureIds: [signature.id]
    }, tenant.account.id);
    assert.equal(issued.credential.status, 'issued');
    assert.match(issued.credential.qualification, /platform-issued/);
    assert.ok(issued.verificationToken);
    const repeated = await service.issueLmsTitle({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      titleType: 'certificate',
      signatureIds: [signature.id]
    }, tenant.account.id);
    assert.equal(repeated.idempotent, true);
    assert.equal(repeated.verificationToken, null);
    assert.equal(service.lmsCertificates.size, 1);
    assert.equal((await service.verifyPublicCredential(issued.credential.publicReference)).status, 'issued');
    const server = createHttpServer({ foundation: service });
    await new Promise((resolve) => server.listen(0, resolve));
    try {
      const printResponse = await fetch(
        `http://127.0.0.1:${server.address().port}/credentials/${issued.credential.id}/print`,
        { headers: { authorization: ['Bearer', tenant.token].join(' ') } }
      );
      assert.equal(printResponse.status, 200);
      assert.match(await printResponse.text(), new RegExp(issued.credential.credentialNumber));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    await service.transitionCredentialStatus(issued.credential.id, {
      status: 'revoked',
      reason: 'Assessment decision annulled',
      authority: 'Training director'
    }, tenant.account.id);
    assert.equal((await service.verifyPublicCredential(issued.credential.publicReference)).status, 'revoked');
  } finally {
    await service.close();
  }
});

test('an exam-only LMS program unlocks its final exam without lessons', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'exam-only');
    const path = await createLmsPath(service, tenant);
    await service.updateCrudResource('lmsLessons', path.lessonOne.id, { status: 'archived' }, tenant.account.id);
    await service.updateCrudResource('lmsLessons', path.lessonTwo.id, { status: 'archived' }, tenant.account.id);
    const finalQuiz = await service.createPlatformRecord('lmsQuizzes', {
      organizationId: tenant.organization.id,
      courseId: path.course.id,
      title: 'Final exam',
      passingScore: 70,
      maxAttempts: 1,
      examType: 'final'
    }, tenant.account.id);
    const question = await service.createPlatformRecord('lmsQuestions', {
      organizationId: tenant.organization.id,
      quizId: finalQuiz.id,
      prompt: 'Final?',
      questionType: 'single',
      correctAnswer: true
    }, tenant.account.id);

    const progress = service.getLmsEnrollmentProgress(path.enrollment.id, tenant.organization.id);
    assert.equal(progress.completed, false);
    assert.equal(progress.finalExamUnlocked, true);
    const attempt = await service.submitLmsQuizAttempt({
      organizationId: tenant.organization.id,
      enrollmentId: path.enrollment.id,
      quizId: finalQuiz.id,
      answers: { [question.id]: true }
    }, tenant.account.id);
    assert.equal(attempt.passed, true);
    assert.equal(service.getLmsEnrollmentProgress(path.enrollment.id, tenant.organization.id).eligibleForTitle, true);
  } finally {
    await service.close();
  }
});

test('secure assets persist through PostgreSQL and new screens expose accessible upload and progress states', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const url = 'postgresql://memory/secure-assets';
  const first = await initializePersistentEducationPlatformService({
    connection: await createPostgresConnection(url, { Pool })
  });
  const tenant = await createTenant(first, 'pg-assets');
  const logo = await first.saveTenantLogo({
    organizationId: tenant.organization.id,
    fileName: 'logo.png',
    mimeType: 'image/png',
    contentBase64: PNG.toString('base64')
  }, tenant.account.id);
  await first.close();

  const reloaded = await initializePersistentEducationPlatformService({
    connection: await createPostgresConnection(url, { Pool })
  });
  try {
    const persisted = reloaded.getTenantLogo(tenant.organization.id);
    assert.equal(persisted.sha256, logo.sha256);
    assert.deepEqual((await reloaded.getTenantLogoContent(tenant.organization.id)).content, PNG);
    const [appSource, styles, guide] = await Promise.all([
      readFile(new URL('../../public/app.js', import.meta.url), 'utf8'),
      readFile(new URL('../../public/styles.css', import.meta.url), 'utf8'),
      readFile(new URL('../../docs/user/module-guide-v1.md', import.meta.url), 'utf8')
    ]);
    assert.match(appSource, /accept="application\/pdf,image\/png,image\/jpeg"/);
    assert.match(appSource, /role="progressbar"/);
    assert.match(appSource, /data-secure-image/);
    assert.match(styles, /\.learning-sequence \.is-locked/);
    assert.match(guide, /pas d’une signature électronique qualifiée/);
  } finally {
    await reloaded.close();
  }
});
