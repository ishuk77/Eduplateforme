export class CountryRuleRegistry {
  constructor() {
    this.rules = new Map();
  }

  register(countryCode, ruleSet) {
    this.rules.set(countryCode.toUpperCase(), ruleSet);
  }

  get(countryCode) {
    return this.rules.get(countryCode.toUpperCase()) ?? null;
  }

  validateOrganizationReference(countryCode, identifier) {
    const rules = this.get(countryCode);

    if (rules?.validateOrganizationIdentifier) {
      return rules.validateOrganizationIdentifier(identifier);
    }

    return true;
  }

  validateNationalOrganizationIdentifier(countryCode, identifier) {
    const rules = this.get(countryCode);

    if (rules?.validateNationalOrganizationIdentifier) {
      return rules.validateNationalOrganizationIdentifier(identifier);
    }

    return this.validateOrganizationReference(countryCode, identifier);
  }

  validateLocalOrganizationIdentifier(countryCode, identifier) {
    const rules = this.get(countryCode);

    if (rules?.validateLocalOrganizationIdentifier) {
      return rules.validateLocalOrganizationIdentifier(identifier);
    }

    return true;
  }

  validatePersonIdentifier(countryCode, identifier) {
    const rules = this.get(countryCode);

    if (rules?.validatePersonIdentifier) {
      return rules.validatePersonIdentifier(identifier);
    }

    return true;
  }
}
