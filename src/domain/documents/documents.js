import {
  Entity,
  assertOptionalString,
  assertPositiveInteger,
  assertRequiredString
} from '../../shared/entity.js';

export class DocumentRecord extends Entity {
  constructor({
    id,
    organizationId,
    personId,
    type,
    title,
    storageReference,
    documentNumber = null,
    versionNumber = 1,
    lineageId = null,
    supersedesDocumentId = null,
    issuedAt = null,
    expiresAt = null,
    recordedAt = new Date()
  }) {
    super({ id, createdAt: recordedAt, updatedAt: recordedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.type = assertRequiredString(type, 'type');
    this.title = assertRequiredString(title, 'title');
    this.storageReference = assertRequiredString(storageReference, 'storageReference');
    this.documentNumber = assertOptionalString(documentNumber, 'documentNumber');
    this.versionNumber = assertPositiveInteger(versionNumber, 'versionNumber');
    this.lineageId = assertOptionalString(lineageId, 'lineageId') ?? this.id;
    this.supersedesDocumentId = assertOptionalString(supersedesDocumentId, 'supersedesDocumentId');
    this.supersededAt = null;
    this.issuedAt = issuedAt;
    this.expiresAt = expiresAt;
  }

  markSuperseded(at = new Date()) {
    this.status = 'superseded';
    this.supersededAt = at;
    this.touch(at);
  }

  createNextVersion(overrides = {}) {
    const recordedAt = overrides.recordedAt ?? new Date();

    return new DocumentRecord({
      id: overrides.id,
      organizationId: this.organizationId,
      personId: this.personId,
      type: overrides.type ?? this.type,
      title: overrides.title ?? this.title,
      storageReference: overrides.storageReference ?? this.storageReference,
      documentNumber: overrides.documentNumber ?? this.documentNumber,
      versionNumber: this.versionNumber + 1,
      lineageId: this.lineageId,
      supersedesDocumentId: this.id,
      issuedAt: overrides.issuedAt ?? this.issuedAt,
      expiresAt: overrides.expiresAt ?? this.expiresAt,
      recordedAt
    });
  }
}

export class CredentialRecord extends Entity {
  constructor({
    id,
    organizationId,
    personId,
    documentId,
    credentialType,
    credentialNumber = null,
    versionNumber = 1,
    lineageId = null,
    supersedesCredentialId = null,
    status = 'issued',
    awardedAt = new Date(),
    revokedAt = null
  }) {
    super({ id, status, createdAt: awardedAt, updatedAt: awardedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.documentId = assertRequiredString(documentId, 'documentId');
    this.credentialType = assertRequiredString(credentialType, 'credentialType');
    this.credentialNumber = assertOptionalString(credentialNumber, 'credentialNumber');
    this.versionNumber = assertPositiveInteger(versionNumber, 'versionNumber');
    this.lineageId = assertOptionalString(lineageId, 'lineageId') ?? this.id;
    this.supersedesCredentialId = assertOptionalString(supersedesCredentialId, 'supersedesCredentialId');
    this.supersededAt = null;
    this.awardedAt = awardedAt;
    this.revokedAt = revokedAt;
  }

  revoke(at = new Date()) {
    this.status = 'revoked';
    this.revokedAt = at;
    this.touch(at);
  }

  markSuperseded(at = new Date()) {
    this.status = 'superseded';
    this.supersededAt = at;
    this.touch(at);
  }

  createNextVersion(overrides = {}) {
    const awardedAt = overrides.awardedAt ?? new Date();

    return new CredentialRecord({
      id: overrides.id,
      organizationId: this.organizationId,
      personId: this.personId,
      documentId: overrides.documentId ?? this.documentId,
      credentialType: overrides.credentialType ?? this.credentialType,
      credentialNumber: overrides.credentialNumber ?? this.credentialNumber,
      versionNumber: this.versionNumber + 1,
      lineageId: this.lineageId,
      supersedesCredentialId: this.id,
      status: overrides.status ?? 'issued',
      awardedAt,
      revokedAt: overrides.revokedAt ?? null
    });
  }
}
