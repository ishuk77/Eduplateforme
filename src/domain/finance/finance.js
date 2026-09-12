import { Entity, assertRequiredString } from '../../shared/entity.js';
import { SUPPORTED_CURRENCIES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

function assertCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new ValidationError(`Unsupported currency: ${currency}`);
  }

  return currency;
}

const ACCESS_POLICIES = Object.freeze([
  'no_payment_required',
  'registration_fee_paid',
  'minimum_percentage',
  'minimum_amount',
  'fully_paid'
]);

export class FeeConfiguration extends Entity {
  constructor({
    id,
    organizationId,
    feeType,
    amount,
    currency = 'USD',
    programId = null,
    accessPolicy = 'no_payment_required',
    minimumPercentage = null,
    minimumAmount = null,
    freeTraining = false
  }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.feeType = assertRequiredString(feeType, 'feeType');
    this.amount = Number(amount);
    if (!Number.isFinite(this.amount) || this.amount < 0) throw new ValidationError('amount must be a non-negative number.');
    this.currency = assertCurrency(currency);
    this.programId = programId;
    if (!ACCESS_POLICIES.includes(accessPolicy)) throw new ValidationError('Unsupported accessPolicy.');
    this.accessPolicy = accessPolicy;
    this.minimumPercentage = minimumPercentage === null || minimumPercentage === '' ? null : Number(minimumPercentage);
    this.minimumAmount = minimumAmount === null || minimumAmount === '' ? null : Number(minimumAmount);
    if (typeof freeTraining !== 'boolean') throw new ValidationError('freeTraining must be a boolean.');
    this.freeTraining = freeTraining;
    if (accessPolicy === 'minimum_percentage'
      && (!Number.isFinite(this.minimumPercentage) || this.minimumPercentage < 0 || this.minimumPercentage > 100)) {
      throw new ValidationError('minimumPercentage must be between 0 and 100.');
    }
    if (accessPolicy === 'minimum_amount'
      && (!Number.isFinite(this.minimumAmount) || this.minimumAmount < 0)) {
      throw new ValidationError('minimumAmount must be a non-negative number.');
    }
  }
}

export { ACCESS_POLICIES };

export class Invoice extends Entity {
  constructor({ id, organizationId, learnerId, feeConfigurationId, amount, currency = 'USD' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.feeConfigurationId = assertRequiredString(feeConfigurationId, 'feeConfigurationId');
    this.amount = Number(amount);
    this.currency = assertCurrency(currency);
    this.balance = this.amount;
  }
}

export class Payment extends Entity {
  constructor({ id, organizationId, invoiceId, amount, currency = 'USD', channel = 'internal' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.invoiceId = assertRequiredString(invoiceId, 'invoiceId');
    this.amount = Number(amount);
    this.currency = assertCurrency(currency);
    this.channel = assertRequiredString(channel, 'channel');
    this.receiptReference = `receipts/${this.id}.pdf`;
  }
}
