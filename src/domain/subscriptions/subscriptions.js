import { Entity, assertRequiredString } from '../../shared/entity.js';
import { SUBSCRIPTION_PLANS } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class PlatformSubscription extends Entity {
  constructor({ id, organizationId, plan, startsOn, endsOn = null, status = 'active' }) {
    super({ id, status });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    if (!SUBSCRIPTION_PLANS.includes(plan)) {
      throw new ValidationError(`Unsupported subscription plan: ${plan}`);
    }

    this.plan = plan;
    this.startsOn = assertRequiredString(startsOn, 'startsOn');
    this.endsOn = endsOn;
  }
}
