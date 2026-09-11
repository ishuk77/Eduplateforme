import { openDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createRepositories } from '../db/repositories/index.js';

export class PersistentEducationPlatformService {
  constructor(db) {
    this.db = db;
    this.repositories = createRepositories(db);
  }

  static bootstrap(options = {}) {
    const db = openDatabase({ filename: options.databasePath });
    runMigrations(db);
    return new PersistentEducationPlatformService(db);
  }

  close() {
    this.db.close();
  }

  registerOrganization({ name, code, actorId = null }) {
    const organization = this.repositories.organizations.create({ name, code, archived_at: null });
    this.#recordAudit({
      organizationId: organization.id,
      actorId,
      eventType: 'organization.created',
      entityType: 'organization',
      entityId: organization.id,
      payload: { name, code }
    });
    return organization;
  }

  registerPerson({ organizationId, firstName, lastName, email, actorId = null }) {
    const person = this.repositories.people.create({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      email,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'person.created',
      entityType: 'person',
      entityId: person.id,
      payload: { firstName, lastName, email }
    });
    return person;
  }

  openUserAccount({ organizationId, personId, username, passwordHash, status = 'active', actorId = null }) {
    const account = this.repositories.userAccounts.create({
      organization_id: organizationId,
      person_id: personId,
      username,
      password_hash: passwordHash,
      status,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'user_account.opened',
      entityType: 'user_account',
      entityId: account.id,
      payload: { personId, username, status }
    });
    return account;
  }

  createRole({ organizationId, roleKey, name, description = null, actorId = null }) {
    const role = this.repositories.roles.create({
      organization_id: organizationId,
      role_key: roleKey,
      name,
      description,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'role.created',
      entityType: 'role',
      entityId: role.id,
      payload: { roleKey, name }
    });
    return role;
  }

  assignRole({ organizationId, roleId, userAccountId, actorId = null }) {
    const assignedAt = new Date().toISOString();
    const assignment = this.repositories.roleAssignments.create({
      organization_id: organizationId,
      role_id: roleId,
      user_account_id: userAccountId,
      assigned_at: assignedAt,
      revoked_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'role.assigned',
      entityType: 'role_assignment',
      entityId: assignment.id,
      payload: { roleId, userAccountId }
    });
    return assignment;
  }

  createAcademicYear({ organizationId, name, startDate, endDate, isActive = false, actorId = null }) {
    const academicYear = this.repositories.academicYears.create({
      organization_id: organizationId,
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive ? 1 : 0,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'academic_year.created',
      entityType: 'academic_year',
      entityId: academicYear.id,
      payload: { name, startDate, endDate, isActive }
    });
    return academicYear;
  }

  createProgram({ organizationId, name, code, actorId = null }) {
    const program = this.repositories.programs.create({
      organization_id: organizationId,
      name,
      code,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'program.created',
      entityType: 'program',
      entityId: program.id,
      payload: { name, code }
    });
    return program;
  }

  createClass({ organizationId, academicYearId, programId = null, name, code, actorId = null }) {
    const schoolClass = this.repositories.classes.create({
      organization_id: organizationId,
      academic_year_id: academicYearId,
      program_id: programId,
      name,
      code,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'class.created',
      entityType: 'class',
      entityId: schoolClass.id,
      payload: { academicYearId, programId, name, code }
    });
    return schoolClass;
  }

  enrollPerson({ organizationId, classId, personId, status = 'active', actorId = null }) {
    const enrolledAt = new Date().toISOString();
    const enrollment = this.repositories.enrollments.create({
      organization_id: organizationId,
      class_id: classId,
      person_id: personId,
      status,
      enrolled_at: enrolledAt,
      withdrawn_at: null,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'enrollment.created',
      entityType: 'enrollment',
      entityId: enrollment.id,
      payload: { classId, personId, status }
    });
    return enrollment;
  }

  registerDocument({ organizationId, personId = null, kind, title, uri, issuedAt = null, actorId = null }) {
    const document = this.repositories.documents.create({
      organization_id: organizationId,
      person_id: personId,
      kind,
      title,
      uri,
      issued_at: issuedAt,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'document.registered',
      entityType: 'document',
      entityId: document.id,
      payload: { personId, kind, title }
    });
    return document;
  }

  registerCredential({ organizationId, personId, documentId = null, kind, issuedAt, expiresAt = null, status = 'active', actorId = null }) {
    const credential = this.repositories.credentials.create({
      organization_id: organizationId,
      person_id: personId,
      document_id: documentId,
      kind,
      issued_at: issuedAt,
      expires_at: expiresAt,
      status,
      archived_at: null
    });

    this.#recordAudit({
      organizationId,
      actorId,
      eventType: 'credential.registered',
      entityType: 'credential',
      entityId: credential.id,
      payload: { personId, documentId, kind, issuedAt, expiresAt, status }
    });
    return credential;
  }

  listAuditEvents() {
    return this.repositories.auditEvents.list();
  }

  #recordAudit({ organizationId, actorId, eventType, entityType, entityId, payload }) {
    const occurredAt = new Date().toISOString();

    this.repositories.auditEvents.create({
      organization_id: organizationId,
      actor_id: actorId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload_json: payload ? JSON.stringify(payload) : null,
      occurred_at: occurredAt
    });
  }
}
