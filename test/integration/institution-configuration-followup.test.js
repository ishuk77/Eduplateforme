import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createHttpServer } from '../../src/http/server.js';
import { createPersistentEducationPlatformService } from '../../src/services/persistent-education-platform-service.js';

async function tenant(service, suffix = 'followup') {
  const { account } = await service.registerUser({
    givenName: 'Admin',
    familyName: suffix,
    username: `admin-${suffix}`,
    email: `admin-${suffix}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(account.id, {
    legalName: `Institution ${suffix}`,
    displayName: `Institution ${suffix}`,
    countryCode: 'SN',
    organizationType: 'school',
    timezone: 'Africa/Dakar',
    dateFormat: 'DD/MM/YYYY',
    latitude: 14.7167,
    longitude: -17.4677
  });
  const year = await service.createAcademicYear({
    organizationId: onboarding.organization.id,
    name: 'Année 2026-2027',
    startsOn: '2026-09-01',
    endsOn: '2027-06-30'
  }, account.id);
  const program = await service.createProgram({
    organizationId: onboarding.organization.id,
    academicYearId: year.id,
    code: `PROGRAM-${suffix}`,
    name: 'Programme général'
  }, account.id);
  const learningClass = await service.createClass({
    organizationId: onboarding.organization.id,
    academicYearId: year.id,
    programId: program.id,
    code: `CLASS-${suffix}`,
    name: 'Groupe A',
    levelCode: '3'
  }, account.id);
  return { account, organization: onboarding.organization, year, program, learningClass };
}

function csvInput(organizationId, kind, headers, row, extra = {}) {
  return {
    organizationId,
    kind,
    fileName: `${kind}.csv`,
    contentBase64: Buffer.from(`${headers.join(',')}\n${row.join(',')}`).toString('base64'),
    ...extra
  };
}

test('organization defaults, localization and academic periods enforce safe configuration', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const first = await tenant(service, 'alpha');
    const second = await service.createOrganizationForAccount(first.account.id, {
      legalName: first.organization.legalName,
      displayName: first.organization.displayName,
      countryCode: 'SN',
      organizationType: 'training-center',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD'
    });
    assert.match(first.organization.internalReference, /^INSTITUTION-ALPHA/);
    assert.notEqual(second.internalReference, first.organization.internalReference);
    assert.equal(first.organization.timezone, 'Africa/Dakar');
    assert.equal(first.organization.dateFormat, 'DD/MM/YYYY');
    assert.equal(first.organization.latitude, 14.7167);
    assert.equal(first.year.code, '2026-2027');

    const period = await service.createAcademicPeriod({
      organizationId: first.organization.id,
      academicYearId: first.year.id,
      periodType: 'trimester',
      sequence: 1,
      code: 'T1',
      name: 'Premier trimestre',
      startsOn: '2026-09-01',
      endsOn: '2026-12-20'
    }, first.account.id);
    assert.equal(period.sequence, 1);
    assert.throws(() => service.createAcademicPeriod({
      organizationId: first.organization.id,
      academicYearId: first.year.id,
      periodType: 'trimester',
      sequence: 1,
      code: 'T1-BIS',
      name: 'Doublon',
      startsOn: '2027-01-01',
      endsOn: '2027-03-01'
    }, first.account.id), /sequence must be unique/);
    assert.throws(() => service.createAcademicPeriod({
      organizationId: first.organization.id,
      academicYearId: first.year.id,
      periodType: 'trimester',
      sequence: 2,
      code: 'T2',
      name: 'Hors année',
      startsOn: '2027-07-01',
      endsOn: '2027-08-01'
    }, first.account.id), /contained within/);
    assert.throws(() => service.createAcademicYear({
      organizationId: first.organization.id,
      name: 'Invalide',
      startsOn: '2027-09-01',
      endsOn: '2027-07-01'
    }, first.account.id), /after startsOn/);
  } finally {
    await service.close();
  }
});

test('catalog and unified people imports are dry-run safe, idempotent and create no-email learner credentials', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const context = await tenant(service, 'imports-new');
    const reference = csvInput(
      context.organization.id,
      'references',
      ['catalog', 'code', 'labelFr', 'labelEn', 'labelEs', 'labelPt', 'labelAr', 'countryCode'],
      ['levels', 'PRIMARY-3', 'Troisième primaire', 'Primary grade 3', '', '', '', 'SN']
    );
    const referencePreview = await service.executeBulkImport(reference, context.account.id);
    assert.equal(referencePreview.summary.valid, 1);
    assert.equal([...service.referenceEntries.values()].some((item) => item.code === 'PRIMARY-3'), false);
    await service.executeBulkImport({
      ...reference,
      dryRun: false,
      confirmed: true,
      idempotencyKey: 'references-1'
    }, context.account.id);
    assert.equal([...service.referenceEntries.values()].find((item) => item.code === 'PRIMARY-3').labels.fr, 'Troisième primaire');

    const headers = ['personType', 'givenName', 'familyName', 'email', 'phone', 'learnerNumber', 'gradeLevel', 'classCode', 'guardianGivenName', 'guardianFamilyName', 'guardianEmail', 'relationship', 'professionalType', 'roleTitle', 'startsOn', 'campusCode', 'createAccount', 'accountPolicy'];
    const people = csvInput(
      context.organization.id,
      'people',
      headers,
      ['learner', 'Awa', 'Diop', '', '', 'LRN-300', '3', context.learningClass.code, 'Mame', 'Diop', 'mame.diop@example.edu', 'mother', '', '', '', '', 'true', '']
    );
    const preview = await service.executeBulkImport(people, context.account.id);
    assert.equal(preview.rows[0].values.accountPolicy, 'parent');
    const applied = await service.executeBulkImport({
      ...people,
      dryRun: false,
      confirmed: true,
      idempotencyKey: 'people-1'
    }, context.account.id);
    assert.equal(applied.credentials.length, 1);
    assert.equal(applied.credentials[0].accountFor, 'guardian');
    assert.equal(applied.credentials[0].temporaryPassword.length >= 16, true);
    assert.equal(service.guardianLearnerRelations.size, 1);

    const learnerAccountInput = csvInput(
      context.organization.id,
      'people',
      headers,
      ['student', 'Ibra', 'Ndiaye', '', '', 'STU-500', '5', context.learningClass.code, '', '', '', '', '', '', '', '', 'true', 'learner']
    );
    const learnerApplied = await service.executeBulkImport({
      ...learnerAccountInput,
      dryRun: false,
      confirmed: true,
      idempotencyKey: 'people-2'
    }, context.account.id);
    assert.equal(learnerApplied.credentials[0].username, 'stu-500');
    assert.equal(learnerApplied.credentials[0].email, null);
    const learnerAccount = [...service.accounts.values()].find((item) => item.username === 'stu-500');
    assert.deepEqual(learnerAccount.loginIdentifiers.map((item) => item.type), ['username']);
    assert.equal(learnerAccount.metadata.forcePasswordChange, true);
  } finally {
    await service.close();
  }
});

test('payment policy hides learner dashboard data until criteria are met and free training bypasses payment', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  try {
    const context = await tenant(service, 'payment');
    const headers = ['personType', 'givenName', 'familyName', 'email', 'phone', 'learnerNumber', 'gradeLevel', 'classCode', 'guardianGivenName', 'guardianFamilyName', 'guardianEmail', 'relationship', 'professionalType', 'roleTitle', 'startsOn', 'campusCode', 'createAccount', 'accountPolicy'];
    const input = csvInput(
      context.organization.id,
      'people',
      headers,
      ['learner', 'Free', 'Learner', '', '', 'PAY-001', '6', context.learningClass.code, '', '', '', '', '', '', '', '', 'true', 'learner'],
      { dryRun: false, confirmed: true, idempotencyKey: 'payment-person' }
    );
    await service.executeBulkImport(input, context.account.id);
    const learner = [...service.learners.values()].find((item) => item.learnerNumber === 'PAY-001');
    const learnerAccount = [...service.accounts.values()].find((item) => item.username === 'pay-001');
    const fee = await service.configureFee({
      organizationId: context.organization.id,
      programId: context.program.id,
      feeType: 'tuition',
      amount: 100,
      currency: 'USD',
      accessPolicy: 'minimum_percentage',
      minimumPercentage: 50
    }, context.account.id);
    const invoice = await service.createInvoice({
      organizationId: context.organization.id,
      learnerId: learner.id,
      feeConfigurationId: fee.id,
      amount: 100,
      currency: 'USD'
    }, context.account.id);
    const pending = service.getRoleDashboard(learnerAccount.id, context.organization.id);
    assert.equal(pending.academicAccess.active, false);
    assert.deepEqual(pending.cards, []);
    const session = await service.createAuthenticationSession(learnerAccount, context.organization.id);
    await new Promise((resolve) => server.listen(0, resolve));
    const blockedLms = await fetch(`http://127.0.0.1:${server.address().port}/lms/catalogs`, {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });
    assert.equal(blockedLms.status, 403);
    const blockedAcademics = await fetch(`http://127.0.0.1:${server.address().port}/academics/years`, {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });
    assert.equal(blockedAcademics.status, 403);
    assert.throws(() => service.updateCrudResource('fees', fee.id, { freeTraining: 'false' }, context.account.id), /must be a boolean/);
    await service.recordPayment({
      organizationId: context.organization.id,
      invoiceId: invoice.id,
      amount: 50,
      currency: 'USD'
    }, context.account.id);
    assert.equal(service.getRoleDashboard(learnerAccount.id, context.organization.id).academicAccess.active, true);
    const availableLms = await fetch(`http://127.0.0.1:${server.address().port}/lms/catalogs`, {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });
    assert.equal(availableLms.status, 200);
    const availableAcademics = await fetch(`http://127.0.0.1:${server.address().port}/academics/years`, {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });
    assert.equal(availableAcademics.status, 200);

    fee.freeTraining = true;
    invoice.balance = 100;
    assert.equal(service.getAcademicAccessForAccount(learnerAccount.id, context.organization.id).reason, 'free_training');
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
});

test('configuration screens expose bounded controls, import entries, help anchors and accessible targets', async () => {
  const [appSource, styles, guide] = await Promise.all([
    readFile(new URL('../../public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../../public/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../../docs/user/module-guide-v1.md', import.meta.url), 'utf8')
  ]);
  assert.match(appSource, /Intl\.supportedValuesOf\('timeZone'\)/);
  assert.match(appSource, /Personnes unifiées \(recommandé\)/);
  assert.match(appSource, /localized-labels/);
  assert.match(appSource, /helpAnchor: 'payment-activation'/);
  assert.match(appSource, /Référence interne \(option avancée\)/);
  assert.match(styles, /button, input, select \{ min-height: 44px; \}/);
  assert.match(guide, /fallback n’est jamais vide/);
});
