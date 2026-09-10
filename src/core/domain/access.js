import { createAccreditationId, createAuthorizationId } from './identifiers.js';

export function createAuthorization({
  authorizationId = createAuthorizationId(),
  organizationId,
  scope,
  grantedBy,
  grantedAt,
  expiresAt = null
}) {
  return {
    authorizationId,
    organizationId,
    scope,
    grantedBy,
    grantedAt,
    expiresAt
  };
}

export function createAccreditation({
  accreditationId = createAccreditationId(),
  organizationId,
  framework,
  level,
  issuedBy,
  validFrom,
  validTo = null
}) {
  return {
    accreditationId,
    organizationId,
    framework,
    level,
    issuedBy,
    validFrom,
    validTo
  };
}
