import { createOrganizationId } from './identifiers.js';

export function createOrganization({
  organizationId = createOrganizationId(),
  tenantId,
  displayName,
  legalName,
  nationalInstitutionId = null,
  countryCode,
  kind = 'school'
}) {
  return {
    organizationId,
    tenantId,
    displayName,
    legalName,
    nationalInstitutionId,
    countryCode,
    kind
  };
}
