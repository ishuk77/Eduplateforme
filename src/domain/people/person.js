import {
  Entity,
  assertArray,
  assertOptionalString,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

function normalizeNationalIdentifier(identifier, index) {
  const value = assertPlainObject(identifier, `nationalIdentifiers[${index}]`);

  return {
    countryCode: assertRequiredString(value.countryCode, `nationalIdentifiers[${index}].countryCode`).toUpperCase(),
    type: assertRequiredString(value.type, `nationalIdentifiers[${index}].type`),
    value: assertRequiredString(value.value, `nationalIdentifiers[${index}].value`)
  };
}

function normalizeContact(contact, index) {
  const value = assertPlainObject(contact, `contacts[${index}]`);

  return {
    type: assertRequiredString(value.type, `contacts[${index}].type`),
    value: assertRequiredString(value.value, `contacts[${index}].value`),
    isPrimary: Boolean(value.isPrimary),
    verifiedAt: value.verifiedAt ?? null
  };
}

export class Person extends Entity {
  constructor({
    id,
    givenName,
    familyName,
    preferredName = null,
    birthDate = null,
    primaryOrganizationId = null,
    countryOfCitizenship = null,
    preferredLocale = null,
    nationalIdentifiers = [],
    contacts = [],
    metadata = {},
    lifecycle = {}
  }) {
    super({ id, status: lifecycle.status ?? 'active' });
    this.givenName = assertRequiredString(givenName, 'givenName');
    this.familyName = assertRequiredString(familyName, 'familyName');
    this.preferredName = assertOptionalString(preferredName, 'preferredName');
    this.birthDate = assertOptionalString(birthDate, 'birthDate');
    this.primaryOrganizationId = assertOptionalString(primaryOrganizationId, 'primaryOrganizationId');
    this.countryOfCitizenship = assertOptionalString(countryOfCitizenship, 'countryOfCitizenship')?.toUpperCase() ?? null;
    this.preferredLocale = assertOptionalString(preferredLocale, 'preferredLocale');
    this.nationalIdentifiers = assertArray(nationalIdentifiers, 'nationalIdentifiers').map(normalizeNationalIdentifier);
    this.contacts = assertArray(contacts, 'contacts').map(normalizeContact);
    this.metadata = assertPlainObject(metadata, 'metadata');
  }
}
