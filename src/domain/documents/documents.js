import {
  Entity,
  ValidationError,
  assertArray,
  assertOptionalString,
  assertPlainObject,
  assertPositiveInteger,
  assertRequiredString
} from '../../shared/entity.js';

export const DOCUMENT_STATUSES = Object.freeze(['active', 'expired', 'archived', 'superseded']);
export const CREDENTIAL_STATUSES = Object.freeze([
  'draft', 'issued', 'valid', 'replaced', 'superseded', 'revoked', 'void', 'suspended', 'expired'
]);
export const SIGNATURE_TYPES = Object.freeze(['visual', 'electronic', 'digital', 'qualified']);
export const COLLABORATION_TYPES = Object.freeze([
  'verification', 'transfer', 'record', 'confirmation', 'recommendation', 'sharing'
]);
export const COLLABORATION_DECISIONS = Object.freeze(['pending', 'accepted', 'refused', 'partial', 'expired']);
export const TRANSFER_STATUSES = Object.freeze([
  'draft', 'requested', 'validated', 'sent', 'acknowledged', 'refused', 'cancelled', 'expired'
]);

function assertEnum(value, values, fieldName) {
  const normalized = assertRequiredString(value, fieldName);
  if (!values.includes(normalized)) {
    throw new ValidationError(`${fieldName} must be one of: ${values.join(', ')}.`);
  }
  return normalized;
}

function assertDate(value, fieldName, { required = false } = {}) {
  if (value == null && !required) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new ValidationError(`${fieldName} must be a valid date.`);
    return value.toISOString();
  }
  const normalized = required
    ? assertRequiredString(value, fieldName)
    : assertOptionalString(value, fieldName);
  if (normalized && Number.isNaN(Date.parse(normalized))) {
    throw new ValidationError(`${fieldName} must be a valid date.`);
  }
  return normalized;
}

function assertDateRange(startsAt, expiresAt) {
  if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
    throw new ValidationError('expiresAt must be after the start date.');
  }
}

function assertStringArray(value, fieldName) {
  return assertArray(value ?? [], fieldName).map((entry, index) =>
    assertRequiredString(entry, `${fieldName}[${index}]`)
  );
}

class OrganizationEntity extends Entity {
  constructor({ id, organizationId, status = 'active', createdAt, updatedAt, archivedAt }) {
    super({ id, status, createdAt, updatedAt, archivedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
  }
}

export class DocumentTemplate extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'active' });
    this.name = assertRequiredString(input.name, 'name');
    this.documentType = assertRequiredString(input.documentType, 'documentType');
    this.versionNumber = assertPositiveInteger(input.versionNumber ?? 1, 'versionNumber');
    this.schema = assertPlainObject(input.schema ?? {}, 'schema');
    this.layoutReference = assertOptionalString(input.layoutReference, 'layoutReference');
    this.requiredSignerFunctions = assertStringArray(input.requiredSignerFunctions, 'requiredSignerFunctions');
    this.publishedAt = assertDate(input.publishedAt, 'publishedAt');
  }

  snapshot() {
    return JSON.parse(JSON.stringify({
      id: this.id,
      name: this.name,
      documentType: this.documentType,
      versionNumber: this.versionNumber,
      schema: this.schema,
      layoutReference: this.layoutReference,
      requiredSignerFunctions: this.requiredSignerFunctions,
      publishedAt: this.publishedAt
    }));
  }
}

export class DocumentRecord extends OrganizationEntity {
  constructor(input) {
    const recordedAt = input.recordedAt ?? input.createdAt ?? new Date();
    super({
      ...input,
      status: input.status ?? 'active',
      createdAt: recordedAt,
      updatedAt: input.updatedAt ?? recordedAt
    });
    this.personId = assertRequiredString(input.personId, 'personId');
    this.type = assertRequiredString(input.type, 'type');
    this.title = assertRequiredString(input.title, 'title');
    this.storageReference = assertRequiredString(input.storageReference, 'storageReference');
    this.fileHash = assertRequiredString(input.fileHash ?? `legacy-unverified:${this.id}`, 'fileHash');
    this.hashAlgorithm = assertEnum(input.hashAlgorithm ?? 'sha256', ['sha256'], 'hashAlgorithm');
    this.documentNumber = assertOptionalString(input.documentNumber, 'documentNumber');
    this.versionNumber = assertPositiveInteger(input.versionNumber ?? 1, 'versionNumber');
    this.lineageId = assertOptionalString(input.lineageId, 'lineageId') ?? this.id;
    this.supersedesDocumentId = assertOptionalString(input.supersedesDocumentId, 'supersedesDocumentId');
    this.supersededAt = input.supersededAt ?? null;
    this.issuedAt = assertDate(input.issuedAt, 'issuedAt');
    this.expiresAt = assertDate(input.expiresAt, 'expiresAt');
    this.archivedAt = input.archivedAt ?? null;
    this.metadata = assertPlainObject(input.metadata ?? {}, 'metadata');
    this.accessLevel = assertEnum(
      input.accessLevel ?? 'restricted',
      ['restricted', 'holder', 'organization', 'shared'],
      'accessLevel'
    );
    this.accessPolicy = assertPlainObject(input.accessPolicy ?? {}, 'accessPolicy');
    this.retentionPolicy = assertPlainObject(input.retentionPolicy ?? { mode: 'retain' }, 'retentionPolicy');
    this.status = assertEnum(input.status ?? 'active', DOCUMENT_STATUSES, 'status');
    assertDateRange(this.issuedAt, this.expiresAt);
  }

  markSuperseded(at = new Date()) {
    this.status = 'superseded';
    this.supersededAt = at;
    this.touch(at);
  }

  createNextVersion(overrides = {}) {
    const recordedAt = overrides.recordedAt ?? new Date();
    return new DocumentRecord({
      ...this,
      ...overrides,
      id: overrides.id,
      organizationId: this.organizationId,
      personId: this.personId,
      versionNumber: this.versionNumber + 1,
      lineageId: this.lineageId,
      supersedesDocumentId: this.id,
      status: 'active',
      supersededAt: null,
      recordedAt
    });
  }
}

export class CredentialRecord extends OrganizationEntity {
  constructor(input) {
    const awardedAt = input.awardedAt ?? input.createdAt ?? new Date();
    super({
      ...input,
      status: input.status ?? 'draft',
      createdAt: awardedAt,
      updatedAt: input.updatedAt ?? awardedAt
    });
    this.personId = assertRequiredString(input.personId, 'personId');
    this.holderId = assertRequiredString(input.holderId ?? input.personId, 'holderId');
    this.issuerOrganizationId = assertRequiredString(
      input.issuerOrganizationId ?? input.organizationId,
      'issuerOrganizationId'
    );
    this.documentId = assertRequiredString(input.documentId, 'documentId');
    this.templateId = assertOptionalString(input.templateId, 'templateId');
    this.templateVersion = input.templateVersion == null
      ? null
      : assertPositiveInteger(input.templateVersion, 'templateVersion');
    this.templateSnapshot = assertPlainObject(input.templateSnapshot ?? {}, 'templateSnapshot');
    this.credentialType = assertRequiredString(input.credentialType, 'credentialType');
    this.credentialNumber = assertRequiredString(input.credentialNumber ?? `LEGACY-${this.id}`, 'credentialNumber');
    this.programId = assertOptionalString(input.programId, 'programId');
    this.qualification = assertRequiredString(input.qualification ?? input.credentialType, 'qualification');
    this.versionNumber = assertPositiveInteger(input.versionNumber ?? 1, 'versionNumber');
    this.lineageId = assertOptionalString(input.lineageId, 'lineageId') ?? this.id;
    this.supersedesCredentialId = assertOptionalString(input.supersedesCredentialId, 'supersedesCredentialId');
    this.replacedByCredentialId = assertOptionalString(input.replacedByCredentialId, 'replacedByCredentialId');
    this.awardedAt = assertDate(awardedAt, 'awardedAt', { required: true });
    this.validFrom = assertDate(input.validFrom ?? awardedAt, 'validFrom', { required: true });
    this.expiresAt = assertDate(input.expiresAt, 'expiresAt');
    this.signatories = assertArray(input.signatories ?? [], 'signatories').map((signatory, index) => {
      const normalized = assertPlainObject(signatory, `signatories[${index}]`);
      return {
        name: assertRequiredString(normalized.name, `signatories[${index}].name`),
        function: assertRequiredString(normalized.function, `signatories[${index}].function`),
        signatureType: assertEnum(
          normalized.signatureType,
          SIGNATURE_TYPES,
          `signatories[${index}].signatureType`
        ),
        evidenceReference: assertOptionalString(
          normalized.evidenceReference,
          `signatories[${index}].evidenceReference`
        ),
        verificationStatus: 'unverified'
      };
    });
    for (const [index, signatory] of this.signatories.entries()) {
      if (signatory.signatureType !== 'visual' && !signatory.evidenceReference) {
        throw new ValidationError(`signatories[${index}].evidenceReference is required for non-visual signatures.`);
      }
    }
    this.legalAssurance = 'declared-not-verified';
    this.sealReference = assertOptionalString(input.sealReference, 'sealReference');
    this.fileHash = assertRequiredString(input.fileHash ?? `legacy-unverified:${this.id}`, 'fileHash');
    this.hashAlgorithm = assertEnum(input.hashAlgorithm ?? 'sha256', ['sha256'], 'hashAlgorithm');
    this.publicReference = assertRequiredString(input.publicReference ?? `legacy-disabled-${this.id}`, 'publicReference');
    this.verificationTokenHash = assertRequiredString(input.verificationTokenHash ?? 'legacy-disabled', 'verificationTokenHash');
    this.publicVerificationEnabled = input.publicVerificationEnabled
      ?? Boolean(input.publicReference && input.verificationTokenHash);
    this.statusHistory = assertArray(input.statusHistory ?? [], 'statusHistory');
    this.revokedAt = input.revokedAt ?? null;
    this.revocationReason = assertOptionalString(input.revocationReason, 'revocationReason');
    this.status = assertEnum(input.status ?? 'draft', CREDENTIAL_STATUSES, 'status');
    assertDateRange(this.validFrom, this.expiresAt);
  }
}

export class ConsentRecord extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'active' });
    this.subjectPersonId = assertRequiredString(input.subjectPersonId, 'subjectPersonId');
    this.authorityPersonId = assertRequiredString(input.authorityPersonId, 'authorityPersonId');
    this.subjectCapacity = assertEnum(input.subjectCapacity, ['minor', 'adult'], 'subjectCapacity');
    this.purpose = assertRequiredString(input.purpose, 'purpose');
    this.dataScope = assertStringArray(input.dataScope, 'dataScope');
    this.recipientOrganizationId = assertRequiredString(input.recipientOrganizationId, 'recipientOrganizationId');
    this.legalBasis = assertRequiredString(input.legalBasis, 'legalBasis');
    this.grantedAt = assertDate(input.grantedAt ?? new Date().toISOString(), 'grantedAt', { required: true });
    this.expiresAt = assertDate(input.expiresAt, 'expiresAt', { required: true });
    this.withdrawnAt = assertDate(input.withdrawnAt, 'withdrawnAt');
    this.withdrawalReason = assertOptionalString(input.withdrawalReason, 'withdrawalReason');
    if (this.subjectCapacity === 'adult' && this.subjectPersonId !== this.authorityPersonId) {
      throw new ValidationError('An adult must grant consent for their own data.');
    }
    assertDateRange(this.grantedAt, this.expiresAt);
  }
}

export class DocumentShare extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'active' });
    this.documentId = assertRequiredString(input.documentId, 'documentId');
    this.recipient = assertRequiredString(input.recipient, 'recipient');
    this.purpose = assertRequiredString(input.purpose, 'purpose');
    this.dataScope = assertStringArray(input.dataScope, 'dataScope');
    this.tokenHash = assertRequiredString(input.tokenHash, 'tokenHash');
    this.expiresAt = assertDate(input.expiresAt, 'expiresAt', { required: true });
    this.consentId = assertOptionalString(input.consentId, 'consentId');
    this.revokedAt = assertDate(input.revokedAt, 'revokedAt');
  }
}

export class CollaborationRequest extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'pending' });
    this.sourceOrganizationId = assertRequiredString(
      input.sourceOrganizationId ?? input.organizationId,
      'sourceOrganizationId'
    );
    this.destinationOrganizationId = assertRequiredString(
      input.destinationOrganizationId,
      'destinationOrganizationId'
    );
    this.requestType = assertEnum(input.requestType, COLLABORATION_TYPES, 'requestType');
    this.purpose = assertRequiredString(input.purpose, 'purpose');
    this.dataScope = assertStringArray(input.dataScope, 'dataScope');
    this.expiresAt = assertDate(input.expiresAt, 'expiresAt', { required: true });
    this.decisionReason = assertOptionalString(input.decisionReason, 'decisionReason');
    this.acceptedDataScope = assertStringArray(input.acceptedDataScope, 'acceptedDataScope');
    this.decidedAt = assertDate(input.decidedAt, 'decidedAt');
    this.status = assertEnum(input.status ?? 'pending', COLLABORATION_DECISIONS, 'status');
  }
}

export class TransferRecord extends OrganizationEntity {
  constructor(input) {
    super({ ...input, status: input.status ?? 'draft' });
    this.sourceOrganizationId = assertRequiredString(
      input.sourceOrganizationId ?? input.organizationId,
      'sourceOrganizationId'
    );
    this.destinationOrganizationId = assertRequiredString(
      input.destinationOrganizationId,
      'destinationOrganizationId'
    );
    this.learnerId = assertRequiredString(input.learnerId, 'learnerId');
    this.requestedData = assertStringArray(input.requestedData, 'requestedData');
    this.authorizationBasis = assertRequiredString(input.authorizationBasis, 'authorizationBasis');
    this.consentId = assertOptionalString(input.consentId, 'consentId');
    this.securePayloadReference = assertRequiredString(input.securePayloadReference, 'securePayloadReference');
    this.encryption = assertPlainObject(input.encryption ?? {}, 'encryption');
    this.destinationClassId = assertOptionalString(input.destinationClassId, 'destinationClassId');
    this.destinationAcademicYearId = assertOptionalString(
      input.destinationAcademicYearId,
      'destinationAcademicYearId'
    );
    this.destinationEnrollmentId = assertOptionalString(
      input.destinationEnrollmentId,
      'destinationEnrollmentId'
    );
    this.validatedAt = assertDate(input.validatedAt, 'validatedAt');
    this.acknowledgedAt = assertDate(input.acknowledgedAt, 'acknowledgedAt');
    this.history = assertArray(input.history ?? [], 'history');
    this.status = assertEnum(input.status ?? 'draft', TRANSFER_STATUSES, 'status');
  }
}
