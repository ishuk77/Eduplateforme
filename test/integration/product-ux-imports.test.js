import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ExcelJS from 'exceljs';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function createTenant(service, suffix, organizationType = 'school') {
  const { account } = await service.registerUser({
    givenName: 'Admin',
    familyName: suffix,
    username: `admin-${suffix}`,
    email: `admin-${suffix}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(account.id, {
    legalName: `Institution ${suffix}`,
    displayName: suffix,
    internalReference: `ORG-${suffix}`,
    countryCode: 'SN',
    organizationType,
    locale: 'fr'
  });
  const year = await service.createAcademicYear({
    organizationId: onboarding.organization.id,
    code: `YEAR-${suffix}`,
    name: '2026-2027',
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
    name: `Classe ${suffix}`
  }, account.id);
  return { ...onboarding, year, program, learningClass };
}

function csvPayload(tenant, overrides = {}) {
  const csv = [
    'givenName,familyName,email,learnerNumber,classCode,createAccount',
    `Awa,Diop,awa-${tenant.organization.internalReference}@example.edu,LRN-${tenant.organization.internalReference},${tenant.learningClass.code},true`
  ].join('\n');
  return {
    organizationId: tenant.organization.id,
    kind: 'learners',
    fileName: 'learners.csv',
    contentBase64: Buffer.from(csv).toString('base64'),
    ...overrides
  };
}

test('country, five locales, RTL and grouped navigation are present with non-empty fallbacks', async () => {
  const [appSource, styles, guide] = await Promise.all([
    readFile(new URL('../../public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../../public/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../../docs/user/module-guide-v1.md', import.meta.url), 'utf8')
  ]);
  assert.match(appSource, /SUPPORTED_LOCALES = \['fr', 'en', 'es', 'pt', 'ar'\]/);
  assert.match(appSource, /Intl\.DisplayNames/);
  assert.match(appSource, /document\.documentElement\.dir = state\.locale === 'ar' \? 'rtl' : 'ltr'/);
  assert.ok(appSource.indexOf("label: 'Configuration'") < appSource.indexOf("label: 'Opérations quotidiennes'"));
  assert.ok(appSource.indexOf("label: 'Opérations quotidiennes'") < appSource.indexOf("label: 'Gouvernance & exploitation'"));
  assert.match(styles, /html\[dir="rtl"\]/);
  assert.match(guide, /fallback n’est jamais vide/);
});

test('role dashboards distinguish institution admin experiences and authorized next steps', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'university', 'university');
    const dashboard = service.getRoleDashboard(tenant.account.id, tenant.organization.id);
    assert.equal(dashboard.role, 'tenant-admin');
    assert.equal(dashboard.experienceRole, 'university-admin');
    assert.ok(dashboard.nextSteps.some((step) => step.path === '/imports'));
    assert.ok(dashboard.availableModules.includes('configuration'));
    assert.equal(service.localizationProfiles.get(tenant.organization.id).language, 'fr');
    await service.updateUserLocale(tenant.account.id, 'ar');
    assert.equal(service.getAuthenticatedUserByAccountId(tenant.account.id, tenant.organization.id).locale, 'ar');

    const roleCases = [
      ['platform-admin', ['operations.read', 'audit.read']],
      ['learner', ['assignments.read', 'lms.read']],
      ['student', ['lms.read', 'grading.read']],
      ['teacher', ['attendance.write', 'grading.write', 'assignments.write']],
      ['trainer', ['lms.write', 'grading.write']],
      ['parent', ['attendance.read', 'communications.read']],
      ['guardian', ['attendance.read', 'communications.read']]
    ];
    for (const [roleCode, permissionCodes] of roleCases) {
      const person = await service.registerPerson({
        givenName: roleCode,
        familyName: 'Dashboard',
        primaryOrganizationId: tenant.organization.id
      }, tenant.account.id);
      const account = await service.openUserAccount({
        personId: person.id,
        username: `dashboard-${roleCode}`,
        email: `dashboard-${roleCode}@example.edu`,
        password: 'correct-horse-battery',
        organizationIds: [tenant.organization.id]
      }, tenant.account.id);
      const role = await service.createRole({
        code: roleCode,
        name: roleCode,
        permissions: permissionCodes
      }, tenant.account.id);
      await service.assignRole({
        personId: person.id,
        roleId: role.id,
        organizationId: tenant.organization.id
      }, tenant.account.id);
      const roleDashboard = service.getRoleDashboard(account.id, tenant.organization.id);
      assert.equal(roleDashboard.experienceRole, roleCode);
      assert.ok(roleDashboard.nextSteps.length > 0);
      assert.ok(roleDashboard.nextSteps.every((step) => typeof step.path === 'string' && step.path.startsWith('/')));
    }
  } finally {
    await service.close();
  }
});

test('help API and reference fields expose prerequisites instead of silent empty selects', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  try {
    const tenant = await createTenant(service, 'help');
    const session = await service.createAuthenticationSession(tenant.account, tenant.organization.id);
    await new Promise((resolve) => server.listen(0, resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/support/help`, {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.version, '1.0');
    assert.deepEqual(payload.localeCoverage.supported, ['fr', 'en', 'es', 'pt', 'ar']);
    assert.ok(payload.guides.every((guide) => guide.permissions.length && guide.prerequisites.length && guide.workflow.length));
    const appSource = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
    assert.match(appSource, /Aucune option autorisée/);
    assert.match(appSource, /Créer le prérequis/);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
});

test('CSV dry-run, transactional apply and idempotent replay create the learner graph', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'csv');
    const input = csvPayload(tenant);
    const dryRun = await service.executeBulkImport(input, tenant.account.id);
    assert.deepEqual(dryRun.summary, { total: 1, valid: 1, invalid: 0 });
    assert.equal(service.learners.size, 0);
    const invalid = await service.executeBulkImport({
      ...input,
      contentBase64: Buffer.from([
        'givenName,familyName,email,learnerNumber,classCode,createAccount',
        `,Diop,not-an-email,,${tenant.learningClass.code},true`
      ].join('\n')).toString('base64')
    }, tenant.account.id);
    assert.equal(invalid.summary.invalid, 1);
    assert.ok(invalid.errors.length >= 3);

    const applied = await service.executeBulkImport({
      ...input, dryRun: false, confirmed: true, idempotencyKey: 'csv-batch-1'
    }, tenant.account.id);
    assert.equal(applied.rows[0].created.person, true);
    assert.equal(applied.rows[0].created.learner, true);
    assert.equal(applied.rows[0].created.enrollment, true);
    assert.equal(applied.credentials.length, 1);
    const credentialRow = await service.connection.get(
      'SELECT password_hash FROM auth_credentials WHERE username = ?',
      [applied.credentials[0].username]
    );
    assert.ok(credentialRow.password_hash);
    assert.equal(credentialRow.password_hash.includes(applied.credentials[0].temporaryPassword), false);

    const replay = await service.executeBulkImport({
      ...input, dryRun: false, confirmed: true, idempotencyKey: 'csv-batch-1'
    }, tenant.account.id);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.credentials, []);
    assert.equal(service.learners.size, 1);
    assert.equal(service.enrollments.size, 1);
  } finally {
    await service.close();
  }
});

test('XLSX import validates rows and rejects formula cells', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Learners');
    sheet.addRow(['givenName', 'familyName', 'email', 'learnerNumber', 'classCode', 'createAccount']);
    sheet.addRow(['Aminata', 'Fall', 'aminata@example.edu', 'XL-001', tenant.learningClass.code, 'false']);
    const valid = await service.executeBulkImport({
      organizationId: tenant.organization.id,
      kind: 'learners',
      fileName: 'learners.xlsx',
      contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')
    }, tenant.account.id);
    assert.equal(valid.summary.valid, 1);
    const applied = await service.executeBulkImport({
      organizationId: tenant.organization.id,
      kind: 'learners',
      fileName: 'learners.xlsx',
      contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64'),
      dryRun: false,
      confirmed: true,
      idempotencyKey: 'xlsx-apply'
    }, tenant.account.id);
    assert.equal(applied.rows[0].created.enrollment, true);

    sheet.getCell('A2').value = { formula: '"Aminata"', result: 'Aminata' };
    await assert.rejects(
      service.executeBulkImport({
        organizationId: tenant.organization.id,
        kind: 'learners',
        fileName: 'formula.xlsx',
        contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')
      }, tenant.account.id),
      /formulas are not accepted/
    );
  } finally {
    await service.close();
  }
});

test('temporary credentials enforce password replacement before issuing a session', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'password');
    const applied = await service.executeBulkImport({
      ...csvPayload(tenant), dryRun: false, confirmed: true, idempotencyKey: 'password-batch'
    }, tenant.account.id);
    const credential = applied.credentials[0];
    const login = await service.authenticate({
      username: credential.username,
      password: credential.temporaryPassword,
      organizationId: tenant.organization.id
    });
    assert.equal(login.passwordChangeRequired, true);
    assert.equal(login.accessToken, undefined);
    const changed = await service.completeRequiredPasswordChange(login.challengeToken, 'a-new-secure-password');
    assert.ok(changed.accessToken);
    assert.equal(service.accounts.get(changed.user.accountId).metadata.forcePasswordChange, false);
    await assert.rejects(
      service.authenticate({ username: credential.username, password: credential.temporaryPassword }),
      /Invalid username or password/
    );
  } finally {
    await service.close();
  }
});

test('bulk import endpoint preserves tenant isolation', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  try {
    const first = await createTenant(service, 'tenant-a');
    const second = await createTenant(service, 'tenant-b');
    const session = await service.createAuthenticationSession(first.account, first.organization.id);
    await new Promise((resolve) => server.listen(0, resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/imports/preview`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(csvPayload(second))
    });
    assert.equal(response.status, 403);
    assert.equal(second.learners, undefined);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
});

test('PostgreSQL async import persistence reloads batch and learner graph', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const url = 'postgresql://memory/imports';
  const first = await initializePersistentEducationPlatformService({
    connection: await createPostgresConnection(url, { Pool })
  });
  const tenant = await createTenant(first, 'pg-import');
  const applied = await first.executeBulkImport({
    ...csvPayload(tenant, { kind: 'class-roster', classId: tenant.learningClass.id }),
    fileName: 'roster.csv',
    contentBase64: Buffer.from([
      'givenName,familyName,email,learnerNumber,createAccount',
      'Fatou,Ndiaye,fatou@example.edu,PG-001,false'
    ].join('\n')).toString('base64'),
    dryRun: false,
    confirmed: true,
    idempotencyKey: 'pg-import-1'
  }, tenant.account.id);
  assert.equal(applied.summary.valid, 1);
  await first.close();

  const reloaded = await initializePersistentEducationPlatformService({
    connection: await createPostgresConnection(url, { Pool })
  });
  try {
    assert.equal(reloaded.importBatches.size, 1);
    assert.equal(reloaded.learners.size, 1);
    assert.equal(reloaded.enrollments.size, 1);
  } finally {
    await reloaded.close();
  }
});
