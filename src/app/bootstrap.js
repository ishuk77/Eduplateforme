import { createCountryConfigurationRegistry } from '../core/domain/country-config.js';

export function bootstrapApplication() {
  const countryConfigurations = createCountryConfigurationRegistry();

  return {
    status: 'ready',
    countryConfigurations
  };
}
