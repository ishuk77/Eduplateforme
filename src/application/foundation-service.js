import { AcademicYear, Enrollment, Learner, LearningClass, Program } from '../domain/academics/academics.js';
import { UserAccount } from '../domain/accounts/user-account.js';
import { DomainEvent } from '../domain/audit/domain-event.js';
import { Permission, PermissionGrant, Role, RoleAssignment } from '../domain/authorization/authorization.js';
import { CredentialRecord, DocumentRecord } from '../domain/documents/documents.js';
import { Organization } from '../domain/organizations/organization.js';
import { Person } from '../domain/people/person.js';
import { CountryRuleRegistry } from '../domain/rules/country-rule-registry.js';
import { ValidationError } from '../shared/entity.js';

export const FOUNDATION_INVARIANTS = Object.freeze([
  'person != account != role',
  'learner_id != enrollment_id',
  'organization_id != national_institution_id',
  'authorization != accreditation',
  'documents and credentials are auditable and version-aware'
]);

export const FOUNDATION_PHASES = Object.freeze([
  'documentation',
  'identity',
  'organizations',
  'academics-and-enrollments',
  'documents-and-credentials',
  'permissions-and-audit',
  'tests-and-bootstrap'
]);

export class FoundationService {
  constructor({ countryRules = new CountryRuleRegistry() } = {}) {
    this.countryRules = countryRules;
    this.organizations = new Map();
    this.people = new Map();
    this.accounts = new Map();
    this.permissions = new Map();
    this.roles = new Map();
    this.roleAssignments = new Map();
    this.permissionGrants = new Map();
    this.learners = new Map();
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

    if (input.nationalInstitutionId !== undefined && input.nationalInstitutionId !== null
      && !this.countryRules.validateNationalOrganizationIdentifier(input.countryCode, input.nationalInstitutionId)) {
      throw new ValidationError('National institution identifier is not valid for the configured country rules.');
    }

    for (const [index, identifier] of (input.localIdentifiers ?? []).entries()) {
      if (!this.countryRules.validateLocalOrganizationIdentifier(input.countryCode, identifier.value)) {
        throw new ValidationError(`Local organization identifier at index ${index} is not valid for the configured country rules.`);
      }
    }

    const organization = new Organization(input);
    this.assertUniqueOrganizationReference(organization);

    if (organization.parentOrganizationId !== null) {
      this.assertExists(this.organizations, organization.parentOrganizationId, 'parent organization');
    }

    this.organizations.set(organization.id, organization);
    this.recordEvent('organization.created', organization, actorId, {
      nationalInstitutionId: organization.nationalInstitutionId
    });
    return organization;
  }

  registerPerson(input, actorId = null) {
    for (const identifier of input.nationalIdentifiers ?? []) {
      if (!this.countryRules.validatePersonIdentifier(identifier.countryCode, identifier.value)) {
        throw new ValidationError('Person identifier is not valid for the configured country rules.');
      }
    }

    const person = new Person(input);
    this.assertUniquePersonIdentifiers(person);
    if (person.primaryOrganizationId !== null) {
      this.assertExists(this.organizations, person.primaryOrganizationId, 'organization');
    }

    this.people.set(person.id, person);
    this.recordEvent('person.registered', person, actorId);
    return person;
  }

  openUserAccount(input, actorId = null) {
    this.assertExists(this.people, input.personId, 'person');
    const account = new UserAccount(input);
    for (const organizationId of account.organizationIds) {
      this.assertExists(this.organizations, organizationId, 'organization');
    }

    this.assertUniqueAccount(account);
    this.accounts.set(account.id, account);
    this.recordEvent('account.opened', account, actorId, {
      loginIdentifiers: account.loginIdentifiers.map(({ type, value }) => ({ type, value }))
    });
    return account;
  }

  createPermission(input, actorId = null) {
    const permission = new Permission(input);
    this.permissions.set(permission.id, permission);
    this.recordEvent('permission.created', permission, actorId);
    return permission;
  }

  createRole(input, actorId = null) {
    for (const [index, permissionCode] of (input.permissions ?? []).entries()) {
      if (!this.findPermissionByCode(permissionCode)) {
        throw new ValidationError(`Unknown permission code at permissions[${index}]: ${permissionCode}`);
      }
    }

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

  createPermissionGrant(input, actorId = null) {
    this.assertExists(this.permissions, input.permissionId, 'permission');
    this.assertExists(this.organizations, input.organizationId, 'organization');

    if (input.personId !== undefined && input.personId !== null) {
      this.assertExists(this.people, input.personId, 'person');
    }

    if (input.accountId !== undefined && input.accountId !== null) {
      this.assertExists(this.accounts, input.accountId, 'account');
    }

    const grant = new PermissionGrant(input);
    this.permissionGrants.set(grant.id, grant);
    this.recordEvent('permission.granted', grant, actorId, { reason: grant.reason });
    return grant;
  }

  createLearner(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    const learner = new Learner(input);
    this.assertUniqueLearner(learner);
    this.learners.set(learner.id, learner);
    this.recordEvent('learner.created', learner, actorId);
    return learner;
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
    if (input.awardingOrganizationId !== undefined && input.awardingOrganizationId !== null) {
      this.assertExists(this.organizations, input.awardingOrganizationId, 'awarding organization');
    }

    const program = new Program(input);
    this.programs.set(program.id, program);
    this.recordEvent('program.created', program, actorId);
    return program;
  }

  createClass(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.academicYears, input.academicYearId, 'academic year');
    this.assertExists(this.programs, input.programId, 'program');
    const program = this.programs.get(input.programId);

    if (program.organizationId !== input.organizationId) {
      throw new ValidationError('Class organization must match program organization.');
    }

    if (program.academicYearId !== input.academicYearId) {
      throw new ValidationError('Class academicYearId must match program academicYearId.');
    }

    const learningClass = new LearningClass(input);
    this.classes.set(learningClass.id, learningClass);
    this.recordEvent('class.created', learningClass, actorId);
    return learningClass;
  }

  createEnrollment(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    this.assertExists(this.learners, input.learnerId, 'learner');
    this.assertExists(this.classes, input.classId, 'class');
    this.assertExists(this.academicYears, input.academicYearId, 'academic year');

    const learner = this.learners.get(input.learnerId);
    const learningClass = this.classes.get(input.classId);

    if (learner.personId !== input.personId) {
      throw new ValidationError('Enrollment personId must match learner.personId.');
    }

    if (learner.organizationId !== input.organizationId) {
      throw new ValidationError('Enrollment organizationId must match learner.organizationId.');
    }

    if (learningClass.organizationId !== input.organizationId) {
      throw new ValidationError('Enrollment organizationId must match class.organizationId.');
    }

    if (learningClass.academicYearId !== input.academicYearId) {
      throw new ValidationError('Enrollment academicYearId must match class.academicYearId.');
    }

    const enrollment = new Enrollment({
      ...input,
      programId: input.programId ?? learningClass.programId
    });

    this.assertUniqueEnrollment(enrollment);
    this.enrollments.set(enrollment.id, enrollment);
    this.recordEvent('enrollment.created', enrollment, actorId);
    return enrollment;
  }

  registerDocument(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    const document = new DocumentRecord(input);
    this.documents.set(document.id, document);
    this.recordEvent('document.registered', document, actorId, { versionNumber: document.versionNumber });
    return document;
  }

  registerDocumentVersion(previousDocumentId, input = {}, actorId = null) {
    this.assertExists(this.documents, previousDocumentId, 'document');
    const previousDocument = this.documents.get(previousDocumentId);
    const document = previousDocument.createNextVersion(input);
    previousDocument.markSuperseded(document.createdAt);
    this.documents.set(document.id, document);
    this.recordEvent('document.versioned', document, actorId, {
      previousDocumentId,
      versionNumber: document.versionNumber,
      lineageId: document.lineageId
    });
    return document;
  }

  issueCredential(input, actorId = null) {
    this.assertExists(this.organizations, input.organizationId, 'organization');
    this.assertExists(this.people, input.personId, 'person');
    this.assertExists(this.documents, input.documentId, 'document');
    const credential = new CredentialRecord(input);
    this.credentials.set(credential.id, credential);
    this.recordEvent('credential.issued', credential, actorId, { versionNumber: credential.versionNumber });
    return credential;
  }

  issueCredentialRevision(previousCredentialId, input = {}, actorId = null) {
    this.assertExists(this.credentials, previousCredentialId, 'credential');
    if (input.documentId !== undefined && input.documentId !== null) {
      this.assertExists(this.documents, input.documentId, 'document');
    }

    const previousCredential = this.credentials.get(previousCredentialId);
    const credential = previousCredential.createNextVersion(input);
    previousCredential.markSuperseded(credential.createdAt);
    this.credentials.set(credential.id, credential);
    this.recordEvent('credential.reissued', credential, actorId, {
      previousCredentialId,
      versionNumber: credential.versionNumber,
      lineageId: credential.lineageId
    });
    return credential;
  }

  recordEvent(type, subject, actorId = null, payload = {}, options = {}) {
    const event = new DomainEvent({
      type,
      actorId,
      actorType: options.actorType ?? (actorId === null ? null : 'account'),
      subjectType: subject.constructor.name,
      subjectId: subject.id,
      organizationId: subject.organizationId ?? options.organizationId ?? null,
      payload,
      correlationId: options.correlationId ?? null,
      causationId: options.causationId ?? null,
      sequenceNumber: this.events.length + 1
    });

    this.events.push(event);
    return event;
  }

  describeFoundation() {
    return {
      name: 'Eduplateforme',
      scope: 'extended-foundation',
      phases: FOUNDATION_PHASES,
      invariants: FOUNDATION_INVARIANTS,
      summary: this.summarize(),
      modules: [
        'organizations',
        'people',
        'accounts',
        'authorization',
        'academics',
        'documents',
        'audit'
      ]
    };
  }

  summarize() {
    return {
      organizations: this.organizations.size,
      people: this.people.size,
      accounts: this.accounts.size,
      roles: this.roles.size,
      permissionGrants: this.permissionGrants.size,
      learners: this.learners.size,
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

  assertUniqueOrganizationReference(organization) {
    for (const existing of this.organizations.values()) {
      if (existing.countryCode === organization.countryCode && existing.internalReference === organization.internalReference) {
        throw new ValidationError(`Organization internalReference already exists for country ${organization.countryCode}.`);
      }

      if (organization.nationalInstitutionId !== null && existing.countryCode === organization.countryCode
        && existing.nationalInstitutionId === organization.nationalInstitutionId) {
        throw new ValidationError(`Organization nationalInstitutionId already exists for country ${organization.countryCode}.`);
      }
    }
  }

  assertUniquePersonIdentifiers(person) {
    for (const existing of this.people.values()) {
      for (const identifier of person.nationalIdentifiers) {
        if (existing.nationalIdentifiers.some((candidate) =>
          candidate.countryCode === identifier.countryCode
          && candidate.type === identifier.type
          && candidate.value === identifier.value
        )) {
          throw new ValidationError(`Duplicate person identifier: ${identifier.countryCode}/${identifier.type}/${identifier.value}`);
        }
      }
    }
  }

  assertUniqueAccount(account) {
    for (const existing of this.accounts.values()) {
      if (existing.username.toLowerCase() === account.username.toLowerCase()) {
        throw new ValidationError(`Username already exists: ${account.username}`);
      }

      if (existing.email === account.email) {
        throw new ValidationError(`Email already exists: ${account.email}`);
      }

      for (const identifier of account.loginIdentifiers) {
        if (existing.loginIdentifiers.some((candidate) =>
          candidate.type === identifier.type && candidate.value === identifier.value
        )) {
          throw new ValidationError(`Login identifier already exists: ${identifier.type}/${identifier.value}`);
        }
      }
    }
  }

  assertUniqueLearner(learner) {
    for (const existing of this.learners.values()) {
      if (existing.organizationId === learner.organizationId && existing.personId === learner.personId) {
        throw new ValidationError(`Learner already exists for person ${learner.personId} in organization ${learner.organizationId}.`);
      }

      if (learner.learnerNumber !== null && existing.organizationId === learner.organizationId
        && existing.learnerNumber === learner.learnerNumber) {
        throw new ValidationError(`Learner number already exists in organization ${learner.organizationId}.`);
      }
    }
  }

  assertUniqueEnrollment(enrollment) {
    for (const existing of this.enrollments.values()) {
      if (existing.organizationId === enrollment.organizationId
        && existing.learnerId === enrollment.learnerId
        && existing.classId === enrollment.classId
        && existing.academicYearId === enrollment.academicYearId
        && existing.status !== 'withdrawn') {
        throw new ValidationError('Active enrollment already exists for this learner and class.');
      }
    }
  }

  findPermissionByCode(code) {
    return Array.from(this.permissions.values()).find((permission) => permission.code === code) ?? null;
  }
}

export function createDefaultFoundation(options) {
  return new FoundationService(options);
}
