import {
  Entity,
  ValidationError,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

export class OperationalRecord extends Entity {
  constructor(input = {}) {
    super(input);
    this.organizationId = assertRequiredString(input.organizationId, 'organizationId');
    for (const [key, value] of Object.entries(input)) {
      if (!['id', 'status', 'createdAt', 'updatedAt', 'archivedAt', 'organizationId'].includes(key)) {
        this[key] = value;
      }
    }
  }
}

export class AnalyticsConfiguration extends OperationalRecord {
  constructor(input = {}) {
    super(input);
    this.privacyMinimum = Number(input.privacyMinimum ?? 5);
    if (!Number.isInteger(this.privacyMinimum) || this.privacyMinimum < 1) {
      throw new ValidationError('privacyMinimum must be a positive integer.');
    }
    this.calculationMethods = assertPlainObject(input.calculationMethods ?? {}, 'calculationMethods');
    this.allowedDimensions = Array.isArray(input.allowedDimensions)
      ? input.allowedDimensions
      : ['period', 'level', 'class', 'program', 'site', 'subject'];
  }
}

export class SupportTicket extends OperationalRecord {
  constructor(input = {}) {
    super(input);
    this.subject = assertRequiredString(input.subject, 'subject');
    this.description = assertRequiredString(input.description, 'description');
    this.priority = input.priority ?? 'normal';
    this.supportLevel = input.supportLevel ?? 'L1';
    this.ticketState = input.ticketState ?? 'open';
    if (!['L1', 'L2', 'L3', 'L4'].includes(this.supportLevel)) {
      throw new ValidationError('supportLevel must be L1, L2, L3, or L4.');
    }
    this.comments = Array.isArray(input.comments) ? input.comments : [];
    this.history = Array.isArray(input.history) ? input.history : [];
  }
}

export class SaasPlan extends OperationalRecord {
  constructor(input = {}) {
    super(input);
    this.code = assertRequiredString(input.code, 'code');
    this.features = Array.isArray(input.features) ? input.features : [];
    this.userQuota = Number(input.userQuota ?? 1);
    this.storageQuotaBytes = Number(input.storageQuotaBytes ?? 0);
    if (!Number.isInteger(this.userQuota) || this.userQuota < 1 || !Number.isFinite(this.storageQuotaBytes) || this.storageQuotaBytes < 0) {
      throw new ValidationError('Plan quotas must be non-negative and userQuota must be at least 1.');
    }
  }
}

export const HIGH_IMPACT_AI_ACTIONS = Object.freeze([
  'admission',
  'exclusion',
  'sanction',
  'promotion',
  'diploma',
  'final_grade'
]);

export const SAFE_AI_ASSISTANCE_ACTIONS = Object.freeze([
  'summarize',
  'translate',
  'draft',
  'explain'
]);
