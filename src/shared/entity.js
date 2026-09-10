import { randomUUID } from 'node:crypto';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function createPermanentId() {
  return randomUUID();
}

export function assertRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  return value.trim();
}

export function assertOptionalString(value, fieldName) {
  if (value == null) {
    return null;
  }

  return assertRequiredString(value, fieldName);
}

export function assertArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array.`);
  }

  return value;
}

export function assertPlainObject(value, fieldName) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object.`);
  }

  return value;
}

export function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ValidationError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

export class Entity {
  constructor({ id = createPermanentId(), status = 'active', createdAt = new Date(), updatedAt = new Date() } = {}) {
    this.id = id;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.archivedAt = null;
  }

  touch(at = new Date()) {
    this.updatedAt = at;
  }

  archive(at = new Date()) {
    if (this.status !== 'archived') {
      this.status = 'archived';
      this.archivedAt = at;
      this.touch(at);
    }
  }

  restore(at = new Date()) {
    if (this.status === 'archived') {
      this.status = 'active';
      this.archivedAt = null;
      this.touch(at);
    }
  }
}
