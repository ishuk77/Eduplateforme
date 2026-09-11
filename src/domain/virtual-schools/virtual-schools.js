import { Entity, assertRequiredString } from '../../shared/entity.js';

export class VirtualSchool extends Entity {
  constructor({ id, organizationId, name, timezone = 'UTC' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.name = assertRequiredString(name, 'name');
    this.timezone = assertRequiredString(timezone, 'timezone');
  }
}

export class PaidTraining extends Entity {
  constructor({ id, organizationId, virtualSchoolId, title, pricingModel = 'free', amount = 0, currency = 'USD', platformCommissionRate = 0 }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.virtualSchoolId = assertRequiredString(virtualSchoolId, 'virtualSchoolId');
    this.title = assertRequiredString(title, 'title');
    this.pricingModel = assertRequiredString(pricingModel, 'pricingModel');
    this.amount = Number(amount);
    this.currency = currency;
    this.platformCommissionRate = Number(platformCommissionRate);
  }
}
