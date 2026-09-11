import {
  Entity,
  ValidationError,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

const SECRET_FIELDS = /(api[-_]?key|secret|token|password|credential|private[-_]?key)/i;

function assertNoSecrets(value, path = 'configuration') {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_FIELDS.test(key)) {
      throw new ValidationError(`Provider secrets must not be stored in ${path}.${key}.`);
    }
    assertNoSecrets(nested, `${path}.${key}`);
  }
}

export class PlatformRecord extends Entity {
  constructor(input = {}) {
    super(input);
    this.organizationId = input.organizationId == null
      ? null
      : assertRequiredString(input.organizationId, 'organizationId');

    for (const [key, value] of Object.entries(input)) {
      if (!['id', 'status', 'createdAt', 'updatedAt', 'archivedAt', 'organizationId'].includes(key)) {
        this[key] = value;
      }
    }
  }
}

export class ExternalProvider extends PlatformRecord {
  constructor(input = {}) {
    super(input);
    this.code = assertRequiredString(input.code, 'code');
    this.providerType = assertRequiredString(input.providerType, 'providerType');
    this.adapterKey = input.adapterKey == null ? null : assertRequiredString(input.adapterKey, 'adapterKey');
    const configuration = input.configuration ?? {};
    assertPlainObject(configuration, 'configuration');
    assertNoSecrets(configuration);
    this.configuration = configuration;
  }
}

export const DATA_QUALITY_DIMENSIONS = Object.freeze([
  'completeness',
  'accuracy',
  'validity',
  'consistency',
  'duplicates',
  'references',
  'timeliness',
  'identifiers'
]);

export class DataQualityRule extends PlatformRecord {
  constructor(input = {}) {
    super(input);
    this.code = assertRequiredString(input.code, 'code');
    this.dimension = assertRequiredString(input.dimension, 'dimension');
    if (!DATA_QUALITY_DIMENSIONS.includes(this.dimension)) {
      throw new ValidationError(`Unsupported data quality dimension: ${this.dimension}`);
    }
    this.targetResource = assertRequiredString(input.targetResource, 'targetResource');
    this.field = assertRequiredString(input.field, 'field');
    this.operator = assertRequiredString(input.operator, 'operator');
    this.weight = Number(input.weight ?? 1);
    if (!Number.isFinite(this.weight) || this.weight <= 0) {
      throw new ValidationError('weight must be a positive number.');
    }
    this.countryCode = input.countryCode ?? null;
  }
}

export class EmisProfile extends ExternalProvider {
  constructor(input = {}) {
    super({ ...input, providerType: input.providerType ?? 'emis' });
    this.countryCode = assertRequiredString(input.countryCode, 'countryCode');
    this.direction = input.direction ?? 'bidirectional';
  }
}

export class ReferenceEntry extends PlatformRecord {
  constructor(input = {}) {
    super(input);
    this.catalog = assertRequiredString(input.catalog, 'catalog');
    this.code = assertRequiredString(input.code, 'code');
    this.labels = assertPlainObject(input.labels, 'labels');
    this.countryCode = input.countryCode ?? null;
    this.standard = input.standard ?? false;
  }
}
