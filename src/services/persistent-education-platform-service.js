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
    return this.#createWithAudit({
      organizationIdForAudit: null,
      actorId,
      eventType: 'organization.created',
      entityType: 'organization',
      payload: { name, code },
      create: () => this.repositories.organizations.create({ name, code, archived_at: null })
    });
  }

  registerPerson({ organizationId, firstName, lastName, email, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'person.created',
      entityType: 'person',
      payload: { firstName, lastName, email },
      create: () =>
        this.repositories.people.create({
          organization_id: organizationId,
          first_name: firstName,
          last_name: lastName,
          email,
          archived_at: null
        })
    });
  }

  openUserAccount({ organizationId, personId, username, passwordHash, status = 'active', actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'user_account.opened',
      entityType: 'user_account',
      payload: { personId, username, status },
      create: () =>
        this.repositories.userAccounts.create({
          organization_id: organizationId,
          person_id: personId,
          username,
          password_hash: passwordHash,
          status,
          archived_at: null
        })
    });
  }

  createRole({ organizationId, roleKey, name, description = null, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'role.created',
      entityType: 'role',
      payload: { roleKey, name },
      create: () =>
        this.repositories.roles.create({
          organization_id: organizationId,
          role_key: roleKey,
          name,
          description,
          archived_at: null
        })
    });
  }

  assignRole({ organizationId, roleId, userAccountId, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'role.assigned',
      entityType: 'role_assignment',
      payload: { roleId, userAccountId },
      create: () =>
        this.repositories.roleAssignments.create({
          organization_id: organizationId,
          role_id: roleId,
          user_account_id: userAccountId,
          assigned_at: new Date().toISOString(),
          revoked_at: null
        })
    });
  }

  createAcademicYear({ organizationId, name, startDate, endDate, isActive = false, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'academic_year.created',
      entityType: 'academic_year',
      payload: { name, startDate, endDate, isActive },
      create: () =>
        this.repositories.academicYears.create({
          organization_id: organizationId,
          name,
          start_date: startDate,
          end_date: endDate,
          is_active: isActive ? 1 : 0,
          archived_at: null
        })
    });
  }

  createProgram({ organizationId, name, code, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'program.created',
      entityType: 'program',
      payload: { name, code },
      create: () =>
        this.repositories.programs.create({
          organization_id: organizationId,
          name,
          code,
          archived_at: null
        })
    });
  }

  createClass({ organizationId, academicYearId, programId = null, name, code, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'class.created',
      entityType: 'class',
      payload: { academicYearId, programId, name, code },
      create: () =>
        this.repositories.classes.create({
          organization_id: organizationId,
          academic_year_id: academicYearId,
          program_id: programId,
          name,
          code,
          archived_at: null
        })
    });
  }

  enrollPerson({ organizationId, classId, personId, status = 'active', actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'enrollment.created',
      entityType: 'enrollment',
      payload: { classId, personId, status },
      create: () =>
        this.repositories.enrollments.create({
          organization_id: organizationId,
          class_id: classId,
          person_id: personId,
          status,
          enrolled_at: new Date().toISOString(),
          withdrawn_at: null,
          archived_at: null
        })
    });
  }

  registerDocument({ organizationId, personId = null, kind, title, uri, issuedAt = null, actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'document.registered',
      entityType: 'document',
      payload: { personId, kind, title },
      create: () =>
        this.repositories.documents.create({
          organization_id: organizationId,
          person_id: personId,
          kind,
          title,
          uri,
          issued_at: issuedAt,
          archived_at: null
        })
    });
  }

  registerCredential({ organizationId, personId, documentId = null, kind, issuedAt, expiresAt = null, status = 'active', actorId = null }) {
    return this.#createWithAudit({
      organizationIdForAudit: organizationId,
      actorId,
      eventType: 'credential.registered',
      entityType: 'credential',
      payload: { personId, documentId, kind, issuedAt, expiresAt, status },
      create: () =>
        this.repositories.credentials.create({
          organization_id: organizationId,
          person_id: personId,
          document_id: documentId,
          kind,
          issued_at: issuedAt,
          expires_at: expiresAt,
          status,
          archived_at: null
        })
    });
  }

  listAuditEvents() {
    return this.repositories.auditEvents.list();
  }

  #createWithAudit({ organizationIdForAudit, actorId, eventType, entityType, payload, create }) {
    const transaction = this.db.transaction(() => {
      const entity = create();
      this.#recordAudit({
        organizationId: organizationIdForAudit ?? entity.organization_id ?? entity.id,
        actorId,
        eventType,
        entityType,
        entityId: entity.id,
        payload
      });
      return entity;
    });

    return transaction();
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
