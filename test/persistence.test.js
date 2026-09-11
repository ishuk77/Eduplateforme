import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { PersistentEducationPlatformService } from '../src/services/persistent-education-platform-service.js';
import { createAppHandler } from '../src/http/app.js';

function createTempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'eduplateforme-'));
  return {
    dir,
    dbPath: join(dir, 'test.sqlite')
  };
}

test('initialisation du schéma SQL', () => {
  const temp = createTempDbPath();
  const db = openDatabase({ filename: temp.dbPath });

  runMigrations(db);

  const tableNames = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);

  assert.deepEqual(
    tableNames.filter((name) => !name.startsWith('sqlite_')),
    [
      'academic_years',
      'audit_events',
      'classes',
      'credentials',
      'documents',
      'enrollments',
      'organizations',
      'people',
      'programs',
      'role_assignments',
      'roles',
      'user_accounts'
    ]
  );

  db.close();
  rmSync(temp.dir, { recursive: true, force: true });
});

test('persistance des entités fondamentales et audit', () => {
  const temp = createTempDbPath();
  const service = PersistentEducationPlatformService.bootstrap({ databasePath: temp.dbPath });

  const organization = service.registerOrganization({ name: 'Lycée Horizon', code: 'LYC-HOR', actorId: 'system' });
  const person = service.registerPerson({
    organizationId: organization.id,
    firstName: 'Amina',
    lastName: 'Diallo',
    email: 'amina.diallo@example.edu',
    actorId: 'system'
  });
  const account = service.openUserAccount({
    organizationId: organization.id,
    personId: person.id,
    username: 'amina',
    passwordHash: 'hashed-secret',
    actorId: 'system'
  });
  const academicYear = service.createAcademicYear({
    organizationId: organization.id,
    name: '2026-2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
    isActive: true,
    actorId: 'system'
  });
  const program = service.createProgram({
    organizationId: organization.id,
    name: 'Sciences',
    code: 'SCI',
    actorId: 'system'
  });
  const schoolClass = service.createClass({
    organizationId: organization.id,
    academicYearId: academicYear.id,
    programId: program.id,
    name: '6A',
    code: '6A-2026',
    actorId: 'system'
  });
  const enrollment = service.enrollPerson({
    organizationId: organization.id,
    classId: schoolClass.id,
    personId: person.id,
    actorId: 'system'
  });
  const document = service.registerDocument({
    organizationId: organization.id,
    personId: person.id,
    kind: 'certificate',
    title: 'Certificat de scolarité',
    uri: 'storage://documents/certificat-1.pdf',
    issuedAt: '2026-09-15',
    actorId: 'system'
  });
  const credential = service.registerCredential({
    organizationId: organization.id,
    personId: person.id,
    documentId: document.id,
    kind: 'student-card',
    issuedAt: '2026-09-20',
    actorId: 'system'
  });

  const persistedOrganization = service.repositories.organizations.findById(organization.id);
  const persistedPerson = service.repositories.people.findById(person.id);
  const persistedAccount = service.repositories.userAccounts.findById(account.id);
  const persistedAcademicYear = service.repositories.academicYears.findById(academicYear.id);
  const persistedClass = service.repositories.classes.findById(schoolClass.id);
  const persistedEnrollment = service.repositories.enrollments.findById(enrollment.id);
  const persistedDocument = service.repositories.documents.findById(document.id);
  const persistedCredential = service.repositories.credentials.findById(credential.id);
  const persistedAuditEvents = service.listAuditEvents();

  assert.equal(persistedOrganization?.name, 'Lycée Horizon');
  assert.equal(persistedPerson?.email, 'amina.diallo@example.edu');
  assert.equal(persistedAccount?.username, 'amina');
  assert.equal(persistedAcademicYear?.name, '2026-2027');
  assert.equal(persistedClass?.code, '6A-2026');
  assert.equal(persistedEnrollment?.status, 'active');
  assert.equal(persistedDocument?.title, 'Certificat de scolarité');
  assert.equal(persistedCredential?.kind, 'student-card');
  assert.ok(persistedAuditEvents.some((event) => event.event_type === 'organization.created'));
  assert.ok(persistedAuditEvents.length >= 8);

  service.close();
  rmSync(temp.dir, { recursive: true, force: true });
});

test('POST /organizations persiste une organisation', async () => {
  const temp = createTempDbPath();
  const service = PersistentEducationPlatformService.bootstrap({ databasePath: temp.dbPath });
  const server = createServer(createAppHandler(service, { maxBodyBytes: 2048 }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/organizations`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Collège Soleil', code: 'COL-SOL' })
  });

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.organization.name, 'Collège Soleil');

  const persisted = service.repositories.organizations.findById(payload.organization.id);
  assert.equal(persisted?.code, 'COL-SOL');

  await new Promise((resolve) => server.close(resolve));
  service.close();
  rmSync(temp.dir, { recursive: true, force: true });
});
