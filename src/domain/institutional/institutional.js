import {
  Entity,
  ValidationError,
  assertArray,
  assertOptionalString,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

const VERIFICATION_STATUSES = Object.freeze([
  'UNVERIFIED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'VERIFIED_BY_AUTHORITY',
  'SUSPENDED',
  'REVOKED'
]);

const AUTHORIZATION_STATUSES = Object.freeze([
  'draft', 'pending', 'active', 'expired', 'suspended', 'revoked'
]);

const ACCREDITATION_TARGETS = Object.freeze([
  'institution', 'site', 'program', 'level', 'qualification'
]);

const LIFECYCLE_EVENTS = Object.freeze([
  'admission',
  'enrollment',
  'promotion',
  'repetition',
  'class_change',
  'program_change',
  'suspension',
  'resumption',
  'withdrawal',
  'expulsion',
  'graduation',
  'certification',
  'death',
  'archiving'
]);

function assertEnum(value, values, fieldName) {
  const normalized = assertRequiredString(value, fieldName);
  if (!values.includes(normalized)) {
    throw new ValidationError(`${fieldName} must be one of: ${values.join(', ')}.`);
  }
  return normalized;
}

function assertDates(startsOn, endsOn, startField = 'startsOn', endField = 'endsOn') {
  if (startsOn && Number.isNaN(Date.parse(startsOn))) {
    throw new ValidationError(`${startField} must be a valid date.`);
  }
  if (endsOn && Number.isNaN(Date.parse(endsOn))) {
    throw new ValidationError(`${endField} must be a valid date.`);
  }
  if (startsOn && endsOn && Date.parse(endsOn) < Date.parse(startsOn)) {
    throw new ValidationError(`${endField} cannot be before ${startField}.`);
  }
}

class OrganizationEntity extends Entity {
  constructor({ id, organizationId, status = 'active', createdAt, updatedAt, archivedAt }) {
    super({ id, status, createdAt, updatedAt, archivedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
  }
}

export class Campus extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.code = assertRequiredString(input.code, 'code');
    this.name = assertRequiredString(input.name, 'name');
    this.campusType = assertOptionalString(input.campusType, 'campusType') ?? 'campus';
    this.address = assertPlainObject(input.address ?? {}, 'address');
    this.contact = assertPlainObject(input.contact ?? {}, 'contact');
    this.timezone = assertOptionalString(input.timezone, 'timezone');
    this.localIdentifier = assertOptionalString(input.localIdentifier, 'localIdentifier');
  }
}

export class OperatingAuthorization extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'draft' });
    this.type = assertRequiredString(input.type, 'type');
    this.authority = assertRequiredString(input.authority, 'authority');
    this.jurisdiction = assertRequiredString(input.jurisdiction, 'jurisdiction');
    this.issuedOn = assertOptionalString(input.issuedOn, 'issuedOn');
    this.validFrom = assertOptionalString(input.validFrom, 'validFrom');
    this.validUntil = assertOptionalString(input.validUntil, 'validUntil');
    this.scope = assertPlainObject(input.scope ?? {}, 'scope');
    this.reference = assertRequiredString(input.reference, 'reference');
    this.evidenceReference = assertOptionalString(input.evidenceReference, 'evidenceReference');
    this.history = assertArray(input.history ?? [], 'history');
    this.status = assertEnum(input.status ?? 'draft', AUTHORIZATION_STATUSES, 'status');
    assertDates(this.validFrom, this.validUntil, 'validFrom', 'validUntil');
  }
}

export class Accreditation extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'draft' });
    this.accreditationType = assertRequiredString(input.accreditationType, 'accreditationType');
    this.authority = assertRequiredString(input.authority, 'authority');
    this.jurisdiction = assertRequiredString(input.jurisdiction, 'jurisdiction');
    this.targetType = assertEnum(input.targetType, ACCREDITATION_TARGETS, 'targetType');
    this.targetId = assertRequiredString(input.targetId, 'targetId');
    this.reference = assertRequiredString(input.reference, 'reference');
    this.validFrom = assertOptionalString(input.validFrom, 'validFrom');
    this.validUntil = assertOptionalString(input.validUntil, 'validUntil');
    this.evidenceReference = assertOptionalString(input.evidenceReference, 'evidenceReference');
    this.history = assertArray(input.history ?? [], 'history');
    this.status = assertEnum(input.status ?? 'draft', AUTHORIZATION_STATUSES, 'status');
    assertDates(this.validFrom, this.validUntil, 'validFrom', 'validUntil');
  }
}

export class InstitutionVerification extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'UNVERIFIED' });
    this.publicCode = assertRequiredString(input.publicCode, 'publicCode');
    this.status = assertEnum(input.status ?? 'UNVERIFIED', VERIFICATION_STATUSES, 'status');
    this.authority = assertOptionalString(input.authority, 'authority');
    this.verifiedAt = assertOptionalString(input.verifiedAt, 'verifiedAt');
    this.validUntil = assertOptionalString(input.validUntil, 'validUntil');
    this.publicNote = assertOptionalString(input.publicNote, 'publicNote');
    this.evidenceReference = assertOptionalString(input.evidenceReference, 'evidenceReference');
    this.history = assertArray(input.history ?? [], 'history');
  }
}

export class GuardianProfile extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.personId = assertRequiredString(input.personId, 'personId');
    this.relationshipTypes = assertArray(input.relationshipTypes ?? [], 'relationshipTypes');
    this.preferredContactChannels = assertArray(input.preferredContactChannels ?? [], 'preferredContactChannels');
    this.notes = assertOptionalString(input.notes, 'notes');
  }
}

export class ProfessionalProfile extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.personId = assertRequiredString(input.personId, 'personId');
    this.professionalType = assertRequiredString(input.professionalType, 'professionalType');
    this.specialties = assertArray(input.specialties ?? [], 'specialties');
    this.qualifications = assertArray(input.qualifications ?? [], 'qualifications');
    this.availability = assertPlainObject(input.availability ?? {}, 'availability');
    this.assignmentOrganizationIds = assertArray(
      input.assignmentOrganizationIds ?? [this.organizationId],
      'assignmentOrganizationIds'
    ).map((organizationId, index) =>
      assertRequiredString(organizationId, `assignmentOrganizationIds[${index}]`)
    );
  }
}

export class GuardianLearnerRelation extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.guardianProfileId = assertRequiredString(input.guardianProfileId, 'guardianProfileId');
    this.learnerId = assertRequiredString(input.learnerId, 'learnerId');
    this.relationship = assertRequiredString(input.relationship, 'relationship');
    this.permissions = assertArray(input.permissions ?? [], 'permissions');
    this.grantedAt = input.grantedAt ?? new Date();
    this.withdrawnAt = input.withdrawnAt ?? null;
    this.withdrawalReason = assertOptionalString(input.withdrawalReason, 'withdrawalReason');
  }
}

export class ProfessionalAssignment extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.professionalProfileId = assertRequiredString(input.professionalProfileId, 'professionalProfileId');
    this.campusId = assertOptionalString(input.campusId, 'campusId');
    this.roleTitle = assertRequiredString(input.roleTitle, 'roleTitle');
    this.employmentType = assertOptionalString(input.employmentType, 'employmentType');
    this.startsOn = assertRequiredString(input.startsOn, 'startsOn');
    this.endsOn = assertOptionalString(input.endsOn, 'endsOn');
    this.history = assertArray(input.history ?? [], 'history');
    assertDates(this.startsOn, this.endsOn);
  }
}

export class AcademicPeriod extends OrganizationEntity {
  constructor(input, { validate = true } = {}) {
    super(input);
    this.academicYearId = assertRequiredString(input.academicYearId, 'academicYearId');
    this.periodType = assertEnum(input.periodType, ['semester', 'trimester'], 'periodType');
    this.sequence = Number(input.sequence ?? String(input.code ?? input.name ?? '').match(/\d+/)?.[0] ?? 1);
    if (validate && (!Number.isInteger(this.sequence) || this.sequence < 1)) {
      throw new ValidationError('sequence must be a positive integer.');
    }
    this.code = assertRequiredString(input.code, 'code');
    this.name = assertRequiredString(input.name, 'name');
    this.startsOn = assertRequiredString(input.startsOn, 'startsOn');
    this.endsOn = assertRequiredString(input.endsOn, 'endsOn');
    assertDates(this.startsOn, this.endsOn);
  }
}

export class AcademicLevel extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.code = assertRequiredString(input.code, 'code');
    this.name = assertRequiredString(input.name, 'name');
    this.specialization = assertOptionalString(input.specialization, 'specialization');
    this.creditsRequired = Number(input.creditsRequired ?? 0);
    if (!Number.isFinite(this.creditsRequired) || this.creditsRequired < 0) {
      throw new ValidationError('creditsRequired must be a non-negative number.');
    }
  }
}

export class Subject extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.code = assertRequiredString(input.code, 'code');
    this.name = assertRequiredString(input.name, 'name');
    this.description = assertOptionalString(input.description, 'description');
    this.defaultCredits = Number(input.defaultCredits ?? 0);
    if (!Number.isFinite(this.defaultCredits) || this.defaultCredits < 0) {
      throw new ValidationError('defaultCredits must be a non-negative number.');
    }
  }
}

export class Course extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.subjectId = assertRequiredString(input.subjectId, 'subjectId');
    this.academicPeriodId = assertRequiredString(input.academicPeriodId, 'academicPeriodId');
    this.classId = assertOptionalString(input.classId, 'classId');
    this.programId = assertOptionalString(input.programId, 'programId');
    this.code = assertRequiredString(input.code, 'code');
    this.name = assertRequiredString(input.name, 'name');
    this.teacherAssignmentIds = assertArray(input.teacherAssignmentIds ?? [], 'teacherAssignmentIds');
    this.credits = Number(input.credits ?? 0);
    if (!this.classId && !this.programId) {
      throw new ValidationError('Course must target a classId or programId.');
    }
  }
}

export class LearnerLifecycleEvent extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.learnerId = assertRequiredString(input.learnerId, 'learnerId');
    this.eventType = assertEnum(input.eventType, LIFECYCLE_EVENTS, 'eventType');
    this.occurredAt = input.occurredAt ?? new Date();
    this.previousContext = assertPlainObject(input.previousContext ?? {}, 'previousContext');
    this.newContext = assertPlainObject(input.newContext ?? {}, 'newContext');
    this.reason = assertOptionalString(input.reason, 'reason');
    this.evidenceReference = assertOptionalString(input.evidenceReference, 'evidenceReference');
    this.authority = assertRequiredString(input.authority, 'authority');
  }
}

export class ContextualPermissionRule extends OrganizationEntity {
  constructor(input) {
    super(input);
    this.roleCode = assertRequiredString(input.roleCode, 'roleCode');
    this.resource = assertRequiredString(input.resource, 'resource');
    this.action = assertRequiredString(input.action, 'action');
    this.scopeType = assertEnum(input.scopeType ?? 'organization', ['organization', 'site', 'program', 'class', 'learner', 'own'], 'scopeType');
    this.scopeId = assertOptionalString(input.scopeId, 'scopeId');
    this.effect = assertEnum(input.effect ?? 'allow', ['allow', 'deny'], 'effect');
  }
}

export {
  ACCREDITATION_TARGETS,
  AUTHORIZATION_STATUSES,
  LIFECYCLE_EVENTS,
  VERIFICATION_STATUSES
};
