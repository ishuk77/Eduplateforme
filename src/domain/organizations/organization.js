import {
  Entity,
  ValidationError,
  assertArray,
  assertOptionalString,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

function normalizeIdentifier(identifier, index, collectionName, defaultScope) {
  const value = assertPlainObject(identifier, `${collectionName}[${index}]`);

  return {
    scope: assertOptionalString(value.scope, `${collectionName}[${index}].scope`) ?? defaultScope,
    type: assertRequiredString(value.type, `${collectionName}[${index}].type`),
    value: assertRequiredString(value.value, `${collectionName}[${index}].value`),
    countryCode: assertOptionalString(value.countryCode, `${collectionName}[${index}].countryCode`)?.toUpperCase() ?? null
  };
}

export class Organization extends Entity {
  constructor({
    id,
    legalName,
    displayName,
    internalReference,
    countryCode,
    nationalInstitutionId = null,
    nationalIdentifiers = [],
    localIdentifiers = [],
    organizationType = 'institution',
    parentOrganizationId = null,
    settings = {},
    lifecycle = {}
  }) {
    super({ id, status: lifecycle.status ?? 'active' });
    this.legalName = assertRequiredString(legalName, 'legalName');
    this.displayName = assertRequiredString(displayName, 'displayName');
    this.internalReference = assertRequiredString(internalReference, 'internalReference');
    this.countryCode = assertRequiredString(countryCode, 'countryCode').toUpperCase();
    this.nationalInstitutionId = assertOptionalString(nationalInstitutionId, 'nationalInstitutionId');
    this.nationalIdentifiers = assertArray(nationalIdentifiers, 'nationalIdentifiers').map((identifier, index) =>
      normalizeIdentifier(identifier, index, 'nationalIdentifiers', 'national')
    );
    this.localIdentifiers = assertArray(localIdentifiers, 'localIdentifiers').map((identifier, index) =>
      normalizeIdentifier(identifier, index, 'localIdentifiers', 'local')
    );
    this.organizationType = assertRequiredString(organizationType, 'organizationType');
    this.parentOrganizationId = assertOptionalString(parentOrganizationId, 'parentOrganizationId');
    this.settings = assertPlainObject(settings, 'settings');

    if (this.nationalInstitutionId !== null && this.nationalInstitutionId === this.internalReference) {
      throw new ValidationError('nationalInstitutionId must remain distinct from internalReference.');
    }
  }
}
