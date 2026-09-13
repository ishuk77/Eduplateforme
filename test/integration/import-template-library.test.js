import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ExcelJS from 'exceljs';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import {
  createCsvTemplate,
  createXlsxPack,
  createXlsxTemplate,
  IMPORT_CONTRACTS,
  parseContractImport
} from '../../src/services/import-template-library.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function tenant(service, suffix = 'library') {
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
    organizationType: 'school',
    locale: 'fr'
  });
  return { account, organization: onboarding.organization };
}

function csvInput(organizationId, kind, rows, suffix = '') {
  const contract = IMPORT_CONTRACTS[kind];
  const csv = [
    contract.fields.map((item) => `"${item.name}"`).join(','),
    ...rows.map((row) => contract.fields.map((item) => `"${String(row[item.name] ?? '').replaceAll('"', '""')}"`).join(','))
  ].join('\r\n');
  return {
    organizationId,
    kind,
    fileName: `${kind}${suffix}.csv`,
    contentBase64: Buffer.from(`\uFEFF${csv}`).toString('base64')
  };
}

async function apply(service, organizationId, kind, rows, number) {
  return service.executeBulkImport({
    ...csvInput(organizationId, kind, rows),
    dryRun: false,
    confirmed: true,
    idempotencyKey: `${kind}-${number}`
  }, 'test-actor');
}

test('catalog templates provide BOM CSV and real XLSX workbooks with dictionaries', async () => {
  assert.ok(Object.keys(IMPORT_CONTRACTS).length >= 15);
  for (const [kind, contract] of Object.entries(IMPORT_CONTRACTS)) {
    const csv = createCsvTemplate(kind);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.deepEqual(
      csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(',').map((value) => value.slice(1, -1)),
      contract.fields.map((item) => item.name)
    );
    const xlsxBuffer = await createXlsxTemplate(kind);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuffer);
    assert.ok(workbook.getWorksheet('Instructions'));
    assert.ok(workbook.getWorksheet('Données'));
    assert.ok(workbook.getWorksheet('Dictionnaire'));
    assert.equal(workbook.getWorksheet('Données').views[0].state, 'frozen');
    assert.ok(workbook.getWorksheet('Données').autoFilter);
    const parsed = await parseContractImport(kind, {
      fileName: `${kind}.xlsx`,
      contentBase64: xlsxBuffer.toString('base64')
    });
    assert.equal(parsed.rows.length, 1);
    assert.deepEqual(parsed.rows[0].values, Object.fromEntries(contract.fields.map((item) => [item.name, item.example])));
  }
  const pack = new ExcelJS.Workbook();
  await pack.xlsx.load(await createXlsxPack());
  assert.ok(pack.getWorksheet('Instructions'));
  assert.ok(pack.getWorksheet('Dictionnaire'));
  assert.ok(pack.getWorksheet('people'));
});

test('imports UI exposes catalog CSV, XLSX, pack and selected-kind upload controls', async () => {
  const source = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /data-template-format="csv"/);
  assert.match(source, /data-template-format="xlsx"/);
  assert.match(source, /template-pack-download/);
  assert.match(source, /kind: data\.get\('kind'\)/);
});

test('strict parser rejects changed headers, signatures, formulas and hostile workbook limits', async () => {
  const valid = csvInput('unused', 'people', [{
    external_id: 'PER-1',
    given_name: 'Amina',
    family_name: 'Mwangi'
  }]);
  await assert.doesNotReject(parseContractImport('people', valid));
  await assert.rejects(parseContractImport('people', {
    ...valid,
    contentBase64: Buffer.from('\uFEFF"given_name","external_id"\r\n"Amina","PER-1"').toString('base64')
  }), /exactly match/);
  await assert.rejects(parseContractImport('people', {
    ...valid,
    contentBase64: Buffer.from('\uFEFF"external_id","given_name","family_name","email","phone","birth_date","preferred_locale","country_of_citizenship"\r\n"PER-1","=2+2","Mwangi","","","","",""').toString('base64')
  }), /formulas are not accepted/);
  await assert.rejects(parseContractImport('people', { ...valid, fileName: 'fake.xlsx' }), /signature/);

  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Données').addRows([
    IMPORT_CONTRACTS.people.fields.map((item) => item.name),
    IMPORT_CONTRACTS.people.fields.map((item) => item.example)
  ]);
  workbook.addWorksheet('Hidden').getCell('A1').value = { formula: 'HYPERLINK("https://invalid.example")', result: 'x' };
  await assert.rejects(parseContractImport('people', {
    fileName: 'hostile.xlsx',
    contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')
  }), /formulas are not accepted/);
});

test('complete relational school round-trip applies by stable references and is idempotent', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const context = await tenant(service, 'roundtrip');
    const organizationId = context.organization.id;
    const badReference = await service.executeBulkImport(csvInput(organizationId, 'learners', [{
      person_external_id: 'UNKNOWN-PERSON',
      learner_number: 'LRN-UNKNOWN'
    }]), context.account.id);
    assert.equal(badReference.summary.invalid, 1);
    assert.deepEqual(badReference.errors[0].field, 'person_external_id');
    const batches = [
      ['campuses', [{ code: 'DAKAR', name: 'Campus Dakar', campus_type: 'main-campus', timezone: 'Africa/Dakar' }]],
      ['people', [
        { external_id: 'PER-L1', given_name: 'Amina', family_name: 'Mwangi', email: 'amina@example.edu', preferred_locale: 'en', country_of_citizenship: 'KE' },
        { external_id: 'PER-G1', given_name: 'Mame', family_name: 'Diop', email: 'mame@example.edu', preferred_locale: 'fr', country_of_citizenship: 'SN' },
        { external_id: 'PER-T1', given_name: 'Lucas', family_name: 'Silva', email: 'lucas@example.edu', preferred_locale: 'pt', country_of_citizenship: 'BR' }
      ]],
      ['learners', [{ person_external_id: 'PER-L1', learner_number: 'LRN-1' }]],
      ['guardians', [{ person_external_id: 'PER-G1', relationship_types: 'mother|guardian', preferred_contact_channels: 'email' }]],
      ['guardian-links', [{ guardian_person_external_id: 'PER-G1', learner_person_external_id: 'PER-L1', relationship: 'mother', permissions: 'academic.read|attendance.read' }]],
      ['professionals', [{ person_external_id: 'PER-T1', professional_type: 'teacher', specialties: 'mathematics' }]],
      ['professional-assignments', [{ professional_person_external_id: 'PER-T1', campus_code: 'DAKAR', role_title: 'teacher', employment_type: 'permanent', starts_on: '2026-09-01' }]],
      ['academic-years', [{ code: '2026-2027', name: '2026-2027', starts_on: '2026-09-01', ends_on: '2027-06-30', calendar_system: 'gregorian' }]],
      ['academic-periods', [{ code: '2026-S1', name: 'Semestre 1', academic_year_code: '2026-2027', period_type: 'semester', sequence: '1', starts_on: '2026-09-01', ends_on: '2027-01-31' }]],
      ['academic-levels', [{ code: 'PRIMARY-1', name: 'Première année primaire', credits_required: '0' }]],
      ['programs', [{ code: 'PRI-2026', name: 'Programme primaire', academic_year_code: '2026-2027', cycle: 'primary' }]],
      ['classes', [{ code: 'P1-A', name: 'Primaire 1 A', academic_year_code: '2026-2027', program_code: 'PRI-2026', level_code: 'PRIMARY-1', campus_code: 'DAKAR' }]],
      ['subjects', [{ code: 'MATH', name: 'Mathématiques', default_credits: '4' }]],
      ['courses', [{ code: 'MATH-P1-S1', name: 'Mathématiques P1', subject_code: 'MATH', academic_period_code: '2026-S1', class_code: 'P1-A', credits: '4' }]],
      ['enrollments', [{ learner_person_external_id: 'PER-L1', class_code: 'P1-A', enrollment_reference: 'ENR-1', status: 'active' }]]
    ];
    let index = 0;
    for (const [kind, rows] of batches) {
      const dryRun = await service.executeBulkImport(csvInput(organizationId, kind, rows), context.account.id);
      assert.equal(dryRun.summary.invalid, 0, `${kind} dry-run`);
      const result = await apply(service, organizationId, kind, rows, index++);
      assert.equal(result.summary.created, rows.length, `${kind} apply`);
    }
    assert.equal(service.people.size, 4);
    assert.equal(service.learners.size, 1);
    assert.equal(service.guardianLearnerRelations.size, 1);
    assert.equal(service.professionalAssignments.size, 1);
    assert.equal(service.courses.size, 1);
    assert.equal(service.enrollments.size, 1);
    const replay = await service.executeBulkImport({
      ...csvInput(organizationId, 'enrollments', batches.at(-1)[1]),
      dryRun: false,
      confirmed: true,
      idempotencyKey: 'enrollments-14'
    }, context.account.id);
    assert.equal(replay.replayed, true);
  } finally {
    await service.close();
  }
});

test('contract apply rolls back every row when persistence fails', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const context = await tenant(service, 'rollback');
    const initialPeople = service.people.size;
    const originalRecordCreate = service.recordCreate.bind(service);
    let importedPeople = 0;
    service.recordCreate = (collection, record, actorId, action) => {
      if (collection === 'people' && action === 'person.import.create' && ++importedPeople === 2) {
        throw new Error('simulated persistence failure');
      }
      return originalRecordCreate(collection, record, actorId, action);
    };
    await assert.rejects(apply(service, context.organization.id, 'people', [
      { external_id: 'ROLL-1', given_name: 'Ana', family_name: 'Silva' },
      { external_id: 'ROLL-2', given_name: 'Mina', family_name: 'Kim' }
    ], 1), /simulated persistence failure/);
    assert.equal(service.people.size, initialPeople);
    assert.equal([...service.people.values()].some((person) => person.metadata?.externalId?.startsWith('ROLL-')), false);
  } finally {
    await service.close();
  }
});

test('updates preserve entity fields that are outside the import contract', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const context = await tenant(service, 'preserve');
    const campus = await service.createCampus({
      organizationId: context.organization.id,
      code: 'MAIN',
      name: 'Original name',
      address: { city: 'Dakar', countryCode: 'SN' },
      contact: { phone: '+221000000000' }
    }, context.account.id);
    const result = await apply(service, context.organization.id, 'campuses', [{
      code: 'MAIN',
      name: 'Updated name',
      campus_type: 'main-campus',
      timezone: 'Africa/Dakar'
    }], 1);
    assert.equal(result.summary.updated, 1);
    assert.deepEqual(service.campuses.get(campus.id).address, { city: 'Dakar', countryCode: 'SN' });
    assert.deepEqual(service.campuses.get(campus.id).contact, { phone: '+221000000000' });
  } finally {
    await service.close();
  }
});

test('HTTP catalog and downloads enforce authentication and tenant scope', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  try {
    const first = await tenant(service, 'http-a');
    const second = await tenant(service, 'http-b');
    const session = await service.createAuthenticationSession(first.account, first.organization.id);
    await new Promise((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/imports/schema`)).status, 401);
    const headers = { authorization: ['Bearer', session.accessToken].join(' ') };
    const catalog = await fetch(`${base}/imports/schema?organizationId=${first.organization.id}`, { headers });
    assert.equal(catalog.status, 200);
    assert.ok((await catalog.json()).contracts.some((item) => item.kind === 'people'));
    const csv = await fetch(`${base}/imports/templates/people?format=csv`, { headers });
    assert.equal(csv.status, 200);
    assert.equal((await csv.arrayBuffer()).byteLength > 50, true);
    const xlsx = await fetch(`${base}/imports/templates/people?format=xlsx`, { headers });
    assert.equal(xlsx.status, 200);
    assert.match(xlsx.headers.get('content-type'), /spreadsheetml/);
    const forbidden = await fetch(`${base}/imports/schema?organizationId=${second.organization.id}`, { headers });
    assert.equal(forbidden.status, 403);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
});

test('legacy account-creating imports keep their full RBAC requirements', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  try {
    const context = await tenant(service, 'rbac');
    const person = await service.registerPerson({
      givenName: 'Limited',
      familyName: 'Operator',
      primaryOrganizationId: context.organization.id
    }, context.account.id);
    const account = await service.openUserAccount({
      personId: person.id,
      username: 'limited-import-operator',
      email: 'limited-import@example.edu',
      password: 'correct-horse-battery',
      organizationIds: [context.organization.id]
    }, context.account.id);
    const role = await service.createRole({
      code: 'limited-people-import',
      name: 'Limited people import',
      permissions: ['people.write']
    }, context.account.id);
    await service.assignRole({
      personId: person.id,
      roleId: role.id,
      organizationId: context.organization.id
    }, context.account.id);
    const session = await service.createAuthenticationSession(account, context.organization.id);
    await new Promise((resolve) => server.listen(0, resolve));
    const csv = [
      'personType,givenName,familyName,email,phone,learnerNumber,gradeLevel,classCode,guardianGivenName,guardianFamilyName,guardianEmail,relationship,professionalType,roleTitle,startsOn,campusCode,createAccount,accountPolicy',
      'staff,Escalation,Attempt,escalation@example.edu,,,,,,,,,teacher,teacher,2026-09-01,,true,'
    ].join('\n');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/imports/preview`, {
      method: 'POST',
      headers: {
        authorization: ['Bearer', session.accessToken].join(' '),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        organizationId: context.organization.id,
        kind: 'people',
        fileName: 'legacy-people.csv',
        contentBase64: Buffer.from(csv).toString('base64')
      })
    });
    assert.equal(response.status, 403);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
});

test('contract imports persist and reload through PostgreSQL pg-mem', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const url = 'postgresql://memory/import-library';
  const first = await initializePersistentEducationPlatformService({
    connection: await createPostgresConnection(url, { Pool })
  });

  const context = await tenant(first, 'library-pg');
  await apply(first, context.organization.id, 'people', [{
    external_id: 'PER-PG-1',
    given_name: 'Amina',
    family_name: 'Mwangi',
    email: 'amina.pg@example.edu'
  }], 1);
  await first.close();

  const reloaded = await initializePersistentEducationPlatformService({
    connection: await createPostgresConnection(url, { Pool })
  });
  try {
    assert.ok([...reloaded.people.values()].some((person) => person.metadata.externalId === 'PER-PG-1'));
    assert.ok([...reloaded.importBatches.values()].some((batch) => batch.kind === 'people'));
  } finally {
    await reloaded.close();
  }
});
