import { Entity, assertRequiredString } from '../../shared/entity.js';
import { SUPPORTED_LANGUAGES, SUPPORTED_CURRENCIES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class LocalizationProfile extends Entity {
  constructor({ id, organizationId, userId = null, countryCode, city, language = 'fr', currency = 'USD', timezone = 'UTC', dateFormat = 'YYYY-MM-DD', calendar = 'gregory', numberingSystem = null }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.countryCode = assertRequiredString(countryCode, 'countryCode');
    this.city = assertRequiredString(city, 'city');
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new ValidationError(`Unsupported language: ${language}`);
    }

    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new ValidationError(`Unsupported currency: ${currency}`);
    }

    this.language = language;
    this.currency = currency;
    this.timezone = assertRequiredString(timezone, 'timezone');
    this.dateFormat = assertRequiredString(dateFormat, 'dateFormat');
    this.calendar = assertRequiredString(calendar, 'calendar');
    this.numberingSystem = numberingSystem;
    this.userId = userId;
  }
}
