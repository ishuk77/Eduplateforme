import { createHash, randomBytes, randomUUID } from 'node:crypto';

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
    const countryCode = String(input.countryCode ?? '').toUpperCase();
    const baseReference = String(input.displayName ?? input.legalName ?? 'ORG')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'ORG';
    let internalReference = String(input.internalReference ?? '').trim().toUpperCase();
    if (!internalReference) {
      internalReference = baseReference;
      let suffix = 2;
      while ([...this.organizations.values()].some((item) =>
        item.countryCode === countryCode && item.internalReference === internalReference
      )) {
        internalReference = `${baseReference.slice(0, 20)}-${suffix++}`;
      }
    }
    const normalizedInput = { ...input, countryCode, internalReference };
    if (!this.countryRules.validateOrganizationReference(countryCode, internalReference)) {
      throw new ValidationError('Organization reference is not valid for the configured country rules.');
    }

    if (normalizedInput.nationalInstitutionId !== undefined && normalizedInput.nationalInstitutionId !== null
      && !this.countryRules.validateNationalOrganizationIdentifier(countryCode, normalizedInput.nationalInstitutionId)) {
      throw new ValidationError('National institution identifier is not valid for the configured country rules.');
    }

    for (const [index, identifier] of (normalizedInput.localIdentifiers ?? []).entries()) {
      if (!this.countryRules.validateLocalOrganizationIdentifier(countryCode, identifier.value)) {
        throw new ValidationError(`Local organization identifier at index ${index} is not valid for the configured country rules.`);
      }
    }

    const organization = new Organization(normalizedInput);
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
    const generatedLabel = `${String(input.startsOn ?? '').slice(0, 4)}-${String(input.endsOn ?? '').slice(0, 4)}`;
    const academicYear = new AcademicYear({
      ...input,
      code: input.code || generatedLabel,
      name: input.name || generatedLabel
    });
    if ([...this.academicYears.values()].some((item) =>
      item.organizationId === academicYear.organizationId && item.code === academicYear.code && item.status !== 'archived'
    )) {
      throw new ValidationError('Academic year code must be unique within the organization.');
    }
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
    const person = this.people.get(input.personId);
    if (person.primaryOrganizationId && person.primaryOrganizationId !== input.organizationId) {
      throw new ValidationError('Document holder must belong to the same organization.');
    }
    const document = new DocumentRecord({
      ...input,
      fileHash: input.fileHash ?? createHash('sha256')
        .update(String(input.fileContent ?? input.storageReference))
        .digest('hex')
    });
    this.documents.set(document.id, document);
    this.recordEvent('document.registered', document, actorId, { versionNumber: document.versionNumber });
    return document;
  }

  registerDocumentVersion(previousDocumentId, input = {}, actorId = null) {
    this.assertExists(this.documents, previousDocumentId, 'document');
    const previousDocument = this.documents.get(previousDocumentId);
    const hashSource = input.fileContent ?? input.storageReference;
    const document = previousDocument.createNextVersion({
      ...input,
      ...(hashSource ? {
        fileHash: createHash('sha256').update(String(hashSource)).digest('hex')
      } : {})
    });
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
    const document = this.documents.get(input.documentId);
    if (input.issuerOrganizationId && input.issuerOrganizationId !== input.organizationId) {
      throw new ValidationError('issuerOrganizationId must match the credential organization.');
    }
    if (input.holderId && input.holderId !== input.personId) {
      throw new ValidationError('holderId must match personId.');
    }
    if (input.programId) {
      this.assertExists(this.programs, input.programId, 'program');
      if (this.programs.get(input.programId).organizationId !== input.organizationId) {
        throw new ValidationError('Credential program must belong to the issuer organization.');
      }
    }
    if (document.organizationId !== input.organizationId || document.personId !== input.personId) {
      throw new ValidationError('Credential document, holder, and issuer must belong to the same organization.');
    }
    const credentialNumber = input.credentialNumber ?? `EDU-${randomUUID().toUpperCase()}`;
    if (Array.from(this.credentials.values()).some((candidate) =>
      candidate.issuerOrganizationId === (input.issuerOrganizationId ?? input.organizationId)
      && candidate.credentialNumber === credentialNumber
    )) {
      throw new ValidationError('credentialNumber must be unique for the issuer.');
    }
    const verificationToken = randomBytes(32).toString('base64url');
    const credential = new CredentialRecord({
      ...input,
      credentialNumber,
      qualification: input.qualification ?? input.credentialType,
      fileHash: input.fileHash ?? document.fileHash,
      publicReference: randomBytes(18).toString('base64url'),
      verificationTokenHash: createHash('sha256').update(verificationToken).digest('hex'),
      publicVerificationEnabled: true,
      status: input.status ?? 'issued'
    });
    this.credentials.set(credential.id, credential);
    this.recordEvent('credential.issued', credential, actorId, { versionNumber: credential.versionNumber });
    Object.defineProperty(credential, 'verificationToken', {
      configurable: true,
      enumerable: false,
      value: verificationToken
    });
    return credential;
  }

  issueCredentialRevision(previousCredentialId, input = {}, actorId = null) {
    this.assertExists(this.credentials, previousCredentialId, 'credential');
    if (input.documentId !== undefined && input.documentId !== null) {
      this.assertExists(this.documents, input.documentId, 'document');
    }

    const previousCredential = this.credentials.get(previousCredentialId);
    const document = this.documents.get(input.documentId ?? previousCredential.documentId);
    if (document.organizationId !== previousCredential.organizationId
      || document.personId !== previousCredential.personId) {
      throw new ValidationError('Replacement document must belong to the original issuer and holder.');
    }
    if (input.organizationId && input.organizationId !== previousCredential.organizationId) {
      throw new ValidationError('Credential organization cannot change during replacement.');
    }
    if (input.personId && input.personId !== previousCredential.personId) {
      throw new ValidationError('Credential holder cannot change during replacement.');
    }
    if (input.programId) {
      this.assertExists(this.programs, input.programId, 'program');
      if (this.programs.get(input.programId).organizationId !== previousCredential.organizationId) {
        throw new ValidationError('Credential program must belong to the original issuer.');
      }
    }
    const verificationToken = randomBytes(32).toString('base64url');
    const credential = new CredentialRecord({
      ...previousCredential,
      ...input,
      id: input.id,
      organizationId: previousCredential.organizationId,
      personId: previousCredential.personId,
      holderId: previousCredential.holderId,
      issuerOrganizationId: previousCredential.issuerOrganizationId,
      documentId: document.id,
      credentialNumber: input.credentialNumber ?? `EDU-${randomUUID().toUpperCase()}`,
      versionNumber: previousCredential.versionNumber + 1,
      lineageId: previousCredential.lineageId,
      supersedesCredentialId: previousCredential.id,
      replacedByCredentialId: null,
      fileHash: input.fileHash ?? document.fileHash,
      publicReference: randomBytes(18).toString('base64url'),
      verificationTokenHash: createHash('sha256').update(verificationToken).digest('hex'),
      publicVerificationEnabled: true,
      status: input.status ?? 'issued',
      statusHistory: []
    });
    const changedAt = new Date();
    previousCredential.status = input.reason || input.replacementReason ? 'replaced' : 'superseded';
    previousCredential.replacedByCredentialId = credential.id;
    previousCredential.touch(changedAt);
    this.credentials.set(credential.id, credential);
    this.recordEvent('credential.reissued', credential, actorId, {
      previousCredentialId,
      versionNumber: credential.versionNumber,
      lineageId: credential.lineageId
    });
    Object.defineProperty(credential, 'verificationToken', {
      configurable: true,
      enumerable: false,
      value: verificationToken
    });
    return credential;
  }

  transitionCredentialStatus(credentialId, input, actorId = null) {
    this.assertExists(this.credentials, credentialId, 'credential');
    const credential = this.credentials.get(credentialId);
    const allowed = {
      draft: ['issued', 'void'],
      issued: ['valid', 'suspended', 'revoked', 'void', 'expired', 'replaced'],
      valid: ['suspended', 'revoked', 'expired', 'replaced'],
      suspended: ['valid', 'revoked', 'expired', 'replaced'],
      replaced: [],
      revoked: [],
      void: [],
      expired: []
    };
    if (!(allowed[credential.status] ?? []).includes(input.status)) {
      throw new ValidationError(`Transition from ${credential.status} to ${input.status} is not allowed.`);
    }
    if (!input.reason) {
      throw new ValidationError('reason is required for credential status transitions.');
    }
    const changedAt = new Date();
    credential.statusHistory.push({
      from: credential.status,
      to: input.status,
      reason: input.reason,
      authority: input.authority ?? null,
      actorId,
      changedAt: changedAt.toISOString()
    });
    credential.status = input.status;
    if (input.status === 'revoked') {
      credential.revokedAt = changedAt;
      credential.revocationReason = input.reason;
    }
    credential.touch(changedAt);
    this.recordEvent(`credential.${input.status}`, credential, actorId, {
      reason: input.reason,
      authority: input.authority ?? null
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
