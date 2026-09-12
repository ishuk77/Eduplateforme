import {
  Entity,
  ValidationError,
  assertArray,
  assertOptionalString,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

export const ORGANIZATION_TYPES = Object.freeze([
  'school', 'university', 'higher-education', 'training-center',
  'institution', 'campus'
]);
export const ORGANIZATION_STATUSES = Object.freeze(['pending', 'operational', 'suspended', 'closed']);
export const ORGANIZATION_DATE_FORMATS = Object.freeze(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD.MM.YYYY']);

function assertChoice(value, choices, fieldName) {
  const normalized = assertRequiredString(value, fieldName);
  if (!choices.includes(normalized)) {
    throw new ValidationError(`${fieldName} must be one of: ${choices.join(', ')}.`);
  }
  return normalized;
}

function assertCoordinate(value, minimum, maximum, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new ValidationError(`${fieldName} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

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
    timezone = 'UTC',
    dateFormat = 'YYYY-MM-DD',
    latitude = null,
    longitude = null,
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
    this.organizationType = assertChoice(organizationType, ORGANIZATION_TYPES, 'organizationType');
    this.parentOrganizationId = assertOptionalString(parentOrganizationId, 'parentOrganizationId');
    this.legalForm = assertOptionalString(legalForm, 'legalForm');
    this.registrationNumber = assertOptionalString(registrationNumber, 'registrationNumber');
    this.taxIdentifier = assertOptionalString(taxIdentifier, 'taxIdentifier');
    this.administrativeAuthority = assertOptionalString(administrativeAuthority, 'administrativeAuthority');
    this.operationalStatus = assertChoice(operationalStatus, ORGANIZATION_STATUSES, 'operationalStatus');
    this.timezone = assertRequiredString(timezone, 'timezone');
    try {
      new Intl.DateTimeFormat('en', { timeZone: this.timezone }).format();
    } catch {
      throw new ValidationError('timezone must be a valid IANA time zone.');
    }
    this.dateFormat = assertChoice(dateFormat, ORGANIZATION_DATE_FORMATS, 'dateFormat');
    this.latitude = assertCoordinate(latitude, -90, 90, 'latitude');
    this.longitude = assertCoordinate(longitude, -180, 180, 'longitude');
    if ((this.latitude === null) !== (this.longitude === null)) {
      throw new ValidationError('latitude and longitude must be provided together.');
    }
    this.headquartersAddress = assertPlainObject(headquartersAddress, 'headquartersAddress');
    this.officialContact = assertPlainObject(officialContact, 'officialContact');
    this.settings = assertPlainObject(settings, 'settings');

    if (this.nationalInstitutionId !== null && this.nationalInstitutionId === this.internalReference) {
      throw new ValidationError('nationalInstitutionId must remain distinct from internalReference.');
    }
  }
}
