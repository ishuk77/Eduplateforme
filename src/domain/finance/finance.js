import { Entity, assertRequiredString } from '../../shared/entity.js';
import { SUPPORTED_CURRENCIES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

function assertCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new ValidationError(`Unsupported currency: ${currency}`);
  }

  return currency;
}

export class FeeConfiguration extends Entity {
  constructor({ id, organizationId, feeType, amount, currency = 'USD' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.feeType = assertRequiredString(feeType, 'feeType');
    this.amount = Number(amount);
    this.currency = assertCurrency(currency);
  }
}

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
