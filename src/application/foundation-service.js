import { Enrollment, AcademicYear, LearningClass, Program } from '../domain/academics/academics.js';
import { UserAccount } from '../domain/accounts/user-account.js';
import { DomainEvent } from '../domain/audit/domain-event.js';
import { Permission, Role, RoleAssignment } from '../domain/authorization/authorization.js';
import { CredentialRecord, DocumentRecord } from '../domain/documents/documents.js';
import { Organization } from '../domain/organizations/organization.js';
import { Person } from '../domain/people/person.js';
import { CountryRuleRegistry } from '../domain/rules/country-rule-registry.js';
import { ValidationError } from '../shared/entity.js';

export class FoundationService {
  constructor({ countryRules = new CountryRuleRegistry() } = {}) {
    this.countryRules = countryRules;
    this.organizations = new Map();
    this.people = new Map();
    this.accounts = new Map();
    this.permissions = new Map();
    this.roles = new Map();
    this.roleAssignments = new Map();
    this.academicYears = new Map();
    this.programs = new Map();
    this.classes = new Map();
    this.enrollments = new Map();
    this.documents = new Map();
    this.credentials = new Map();
    this.events = [];
  }

  createOrganization(input, actorId = null) {
    if (!this.countryRules.validateOrganizationReference(input.countryCode, input.internalReference)) {
      throw new ValidationError('Organization reference is not valid for the configured country rules.');
    }

    const organization = new Organization(input);
    this.organizations.set(organization.id, organization);
    this.recordEvent('organization.created', organization, actorId);
    return organization;
  }

  registerPerson(input, actorId = null) {
    for (const identifier of input.nationalIdentifiers ?? []) {
      if (!this.countryRules.validatePersonIdentifier(identifier.countryCode, identifier.value)) {
        throw new ValidationError('Person identifier is not valid for the configured country rules.');
      }
    }

    const person = new Person(input);
    this.people.set(person.id, person);
    this.recordEvent('person.registered', person, actorId);
    return person;
  }

  openUserAccount(input, actorId = null) {
    this.assertExists(this.people, input.personId, 'person');
    const account = new UserAccount(input);
    this.accounts.set(account.id, account);
    this.recordEvent('account.opened', account, actorId);
    return account;
  }

  createPermission(input, actorId = null) {
    const permission = new Permission(input);
    this.permissions.set(permission.id, permission);
    this.recordEvent('permission.created', permission, actorId);
    return permission;
  }

  createRole(input, actorId = null) {
    const role = new Role(input);
    this.roles.set(role.id, role);
    this.recordEvent('role.created', role, actorId);
    return role;
  }

  assignRole(input, actorId = null) {
    this.assertExists(this.people, input.personId, 'person');
    this.assertExists(this.roles, input.roleId, 'role');
    this.assertExists(this.organizations, input.organizationId, 'organization');
    const assignment = new RoleAssignment(input);
    this.roleAssignments.set(assignment.id, assignment);
    this.recordEvent('role.assigned', assignment, actorId);
    return assignment;
  }

  createAcademicYear(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    const academicYear = new AcademicYear(input);
    this.academicYears.set(academicYear.id, academicYear);
    this.recordEvent('academic-year.created', academicYear, actorId);
    return academicYear;
  }

  createProgram(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.academicYears, input.academicYearId, 'academic year');
    const program = new Program(input);
    this.programs.set(program.id, program);
    this.recordEvent('program.created', program, actorId);
    return program;
  }

  createClass(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.academicYears, input.academicYearId, 'academic year');
    this.assertExists(this.programs, input.programId, 'program');
    const learningClass = new LearningClass(input);
    this.classes.set(learningClass.id, learningClass);
    this.recordEvent('class.created', learningClass, actorId);
    return learningClass;
  }

  createEnrollment(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    this.assertExists(this.classes, input.classId, 'class');
    this.assertExists(this.academicYears, input.academicYearId, 'academic year');
    const enrollment = new Enrollment(input);
    this.enrollments.set(enrollment.id, enrollment);
    this.recordEvent('enrollment.created', enrollment, actorId);
    return enrollment;
  }

  registerDocument(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    const document = new DocumentRecord(input);
    this.documents.set(document.id, document);
    this.recordEvent('document.registered', document, actorId);
    return document;
  }

  issueCredential(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    this.assertExists(this.documents, input.documentId, 'document');
    const credential = new CredentialRecord(input);
    this.credentials.set(credential.id, credential);
    this.recordEvent('credential.issued', credential, actorId);
    return credential;
  }

  recordEvent(type, subject, actorId = null, payload = {}) {
    const event = new DomainEvent({
      type,
      actorId,
      subjectType: subject.constructor.name,
      subjectId: subject.id,
      organizationId: subject.organizationId ?? null,
      payload
    });

    this.events.push(event);
    return event;
  }

  summarize() {
    return {
      organizations: this.organizations.size,
      people: this.people.size,
      accounts: this.accounts.size,
      roles: this.roles.size,
      enrollments: this.enrollments.size,
      documents: this.documents.size,
      credentials: this.credentials.size,
      events: this.events.length
    };
  }

  assertExists(collection, id, label) {
    if (!collection.has(id)) {
      throw new ValidationError(`Unknown ${label}: ${id}`);
    }
  }
}

export function createDefaultFoundation(options) {
  return new FoundationService(options);
}
