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
    legalForm = null,
    registrationNumber = null,
    taxIdentifier = null,
    administrativeAuthority = null,
    operationalStatus = 'operational',
    headquartersAddress = {},
    officialContact = {},
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
    this.legalForm = assertOptionalString(legalForm, 'legalForm');
    this.registrationNumber = assertOptionalString(registrationNumber, 'registrationNumber');
    this.taxIdentifier = assertOptionalString(taxIdentifier, 'taxIdentifier');
    this.administrativeAuthority = assertOptionalString(administrativeAuthority, 'administrativeAuthority');
    this.operationalStatus = assertRequiredString(operationalStatus, 'operationalStatus');
    this.headquartersAddress = assertPlainObject(headquartersAddress, 'headquartersAddress');
    this.officialContact = assertPlainObject(officialContact, 'officialContact');
    this.settings = assertPlainObject(settings, 'settings');

    if (this.nationalInstitutionId !== null && this.nationalInstitutionId === this.internalReference) {
      throw new ValidationError('nationalInstitutionId must remain distinct from internalReference.');
    }
  }
}
