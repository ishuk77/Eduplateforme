import { SqlRepository } from './sql-repository.js';

export function createRepositories(db) {
  return {
    organizations: new SqlRepository(db, {
      table: 'organizations',
      columns: ['id', 'name', 'code', 'archived_at', 'created_at', 'updated_at'],
      required: ['name', 'code']
    }),
    people: new SqlRepository(db, {
      table: 'people',
      columns: ['id', 'organization_id', 'first_name', 'last_name', 'email', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'first_name', 'last_name', 'email']
    }),
    userAccounts: new SqlRepository(db, {
      table: 'user_accounts',
      columns: ['id', 'organization_id', 'person_id', 'username', 'password_hash', 'status', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'person_id', 'username', 'password_hash', 'status']
    }),
    roles: new SqlRepository(db, {
      table: 'roles',
      columns: ['id', 'organization_id', 'role_key', 'name', 'description', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'role_key', 'name']
    }),
    roleAssignments: new SqlRepository(db, {
      table: 'role_assignments',
      columns: ['id', 'organization_id', 'role_id', 'user_account_id', 'assigned_at', 'revoked_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'role_id', 'user_account_id', 'assigned_at']
    }),
    academicYears: new SqlRepository(db, {
      table: 'academic_years',
      columns: ['id', 'organization_id', 'name', 'start_date', 'end_date', 'is_active', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'name', 'start_date', 'end_date', 'is_active']
    }),
    programs: new SqlRepository(db, {
      table: 'programs',
      columns: ['id', 'organization_id', 'name', 'code', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'name', 'code']
    }),
    classes: new SqlRepository(db, {
      table: 'classes',
      columns: ['id', 'organization_id', 'academic_year_id', 'program_id', 'name', 'code', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'academic_year_id', 'name', 'code']
    }),
    enrollments: new SqlRepository(db, {
      table: 'enrollments',
      columns: ['id', 'organization_id', 'class_id', 'person_id', 'status', 'enrolled_at', 'withdrawn_at', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'class_id', 'person_id', 'status', 'enrolled_at']
    }),
    documents: new SqlRepository(db, {
      table: 'documents',
      columns: ['id', 'organization_id', 'person_id', 'kind', 'title', 'uri', 'issued_at', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'kind', 'title', 'uri']
    }),
    credentials: new SqlRepository(db, {
      table: 'credentials',
      columns: ['id', 'organization_id', 'person_id', 'document_id', 'kind', 'issued_at', 'expires_at', 'status', 'archived_at', 'created_at', 'updated_at'],
      required: ['organization_id', 'person_id', 'kind', 'issued_at', 'status']
    }),
    auditEvents: new SqlRepository(db, {
      table: 'audit_events',
      columns: ['id', 'organization_id', 'actor_id', 'event_type', 'entity_type', 'entity_id', 'payload_json', 'occurred_at', 'created_at'],
      required: ['event_type', 'entity_type', 'entity_id', 'occurred_at'],
      orderBy: 'occurred_at ASC, id ASC'
    })
  };
}
