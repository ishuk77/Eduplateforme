import {
  Entity,
  assertOptionalString,
  assertPlainObject,
  assertPositiveInteger,
  assertRequiredString
} from '../../shared/entity.js';

export class DomainEvent extends Entity {
  constructor({
    id,
    type,
    category = null,
    actorId = null,
    actorType = null,
    subjectType,
    subjectId,
    organizationId = null,
    correlationId = null,
    causationId = null,
    sequenceNumber = null,
    payload = {},
    occurredAt = new Date()
  }) {
    super({ id, createdAt: occurredAt, updatedAt: occurredAt });
    this.type = assertRequiredString(type, 'type');
    this.category = assertOptionalString(category, 'category') ?? this.type.split('.')[0];
    this.actorId = actorId;
    this.actorType = assertOptionalString(actorType, 'actorType');
    this.subjectType = assertRequiredString(subjectType, 'subjectType');
    this.subjectId = assertRequiredString(subjectId, 'subjectId');
    this.organizationId = organizationId;
    this.correlationId = assertOptionalString(correlationId, 'correlationId');
    this.causationId = assertOptionalString(causationId, 'causationId');
    this.sequenceNumber = sequenceNumber === null ? null : assertPositiveInteger(sequenceNumber, 'sequenceNumber');
    this.payload = assertPlainObject(payload, 'payload');
    this.occurredAt = occurredAt;
  }
}
