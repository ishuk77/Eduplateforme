import { Entity, assertArray, assertRequiredString } from '../../shared/entity.js';

export class Organization extends Entity {
  constructor({
    id,
    legalName,
    displayName,
    internalReference,
    countryCode,
    nationalIdentifiers = [],
    settings = {},
    lifecycle = {}
  }) {
    super({ id, status: lifecycle.status ?? 'active' });
    this.legalName = assertRequiredString(legalName, 'legalName');
    this.displayName = assertRequiredString(displayName, 'displayName');
    this.internalReference = assertRequiredString(internalReference, 'internalReference');
    this.countryCode = assertRequiredString(countryCode, 'countryCode').toUpperCase();
    this.nationalIdentifiers = assertArray(nationalIdentifiers, 'nationalIdentifiers');
    this.settings = settings;
  }
}
