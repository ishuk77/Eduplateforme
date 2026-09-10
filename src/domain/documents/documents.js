import { Entity, assertRequiredString } from '../../shared/entity.js';

export class DocumentRecord extends Entity {
  constructor({
    id,
    organizationId,
    personId,
    type,
    title,
    storageReference,
    issuedAt = null,
    expiresAt = null
  }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.type = assertRequiredString(type, 'type');
    this.title = assertRequiredString(title, 'title');
    this.storageReference = assertRequiredString(storageReference, 'storageReference');
    this.issuedAt = issuedAt;
    this.expiresAt = expiresAt;
  }
}

export class CredentialRecord extends Entity {
  constructor({
    id,
    organizationId,
    personId,
    documentId,
    credentialType,
    status = 'issued',
    awardedAt = new Date(),
    revokedAt = null
  }) {
    super({ id, status, createdAt: awardedAt, updatedAt: awardedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.documentId = assertRequiredString(documentId, 'documentId');
    this.credentialType = assertRequiredString(credentialType, 'credentialType');
    this.awardedAt = awardedAt;
    this.revokedAt = revokedAt;
  }

  revoke(at = new Date()) {
    this.status = 'revoked';
    this.revokedAt = at;
    this.touch(at);
  }
}
