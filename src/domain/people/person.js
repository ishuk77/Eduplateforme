import { Entity, assertArray, assertRequiredString } from '../../shared/entity.js';

export class Person extends Entity {
  constructor({
    id,
    givenName,
    familyName,
    preferredName = null,
    birthDate = null,
    nationalIdentifiers = [],
    contacts = [],
    metadata = {}
  }) {
    super({ id });
    this.givenName = assertRequiredString(givenName, 'givenName');
    this.familyName = assertRequiredString(familyName, 'familyName');
    this.preferredName = preferredName;
    this.birthDate = birthDate;
    this.nationalIdentifiers = assertArray(nationalIdentifiers, 'nationalIdentifiers');
    this.contacts = assertArray(contacts, 'contacts');
    this.metadata = metadata;
  }
}
