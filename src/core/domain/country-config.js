export function createCountryConfigurationRegistry(seed = {}) {
  const registry = new Map(Object.entries(seed));

  return {
    set(countryCode, configuration) {
      registry.set(countryCode, configuration);
    },
    get(countryCode) {
      return registry.get(countryCode) ?? null;
    },
    has(countryCode) {
      return registry.has(countryCode);
    },
    listCountryCodes() {
      return [...registry.keys()];
    }
  };
}
