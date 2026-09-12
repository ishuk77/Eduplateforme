import { Entity, assertRequiredString } from '../../shared/entity.js';
import { SUPPORTED_LANGUAGES, SUPPORTED_CURRENCIES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class LocalizationProfile extends Entity {
  constructor({ id, organizationId, userId = null, countryCode, city, language = 'fr', currency = 'USD', timezone = 'UTC', dateFormat = 'YYYY-MM-DD', calendar = 'gregory', numberingSystem = null, latitude = null, longitude = null }, { validate = true } = {}) {
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
    if (validate) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: this.timezone }).format();
      } catch {
        throw new ValidationError('timezone must be a valid IANA time zone.');
      }
      if (!['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD.MM.YYYY'].includes(dateFormat)) {
        throw new ValidationError('Unsupported dateFormat.');
      }
    }
    this.dateFormat = assertRequiredString(dateFormat, 'dateFormat');
    this.calendar = assertRequiredString(calendar, 'calendar');
    this.numberingSystem = numberingSystem;
    this.userId = userId;
    this.latitude = latitude === null || latitude === '' ? null : Number(latitude);
    this.longitude = longitude === null || longitude === '' ? null : Number(longitude);
    if (validate && ((this.latitude === null) !== (this.longitude === null)
      || (this.latitude !== null && (!Number.isFinite(this.latitude) || this.latitude < -90 || this.latitude > 90))
      || (this.longitude !== null && (!Number.isFinite(this.longitude) || this.longitude < -180 || this.longitude > 180)))) {
      throw new ValidationError('latitude and longitude must be valid and provided together.');
    }
  }
}
