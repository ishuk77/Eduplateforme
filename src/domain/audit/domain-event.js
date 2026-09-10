import { Entity, assertRequiredString } from '../../shared/entity.js';

export class DomainEvent extends Entity {
  constructor({
    id,
    type,
    actorId = null,
    subjectType,
    subjectId,
    organizationId = null,
    payload = {},
    occurredAt = new Date()
  }) {
    super({ id, createdAt: occurredAt, updatedAt: occurredAt });
    this.type = assertRequiredString(type, 'type');
    this.actorId = actorId;
    this.subjectType = assertRequiredString(subjectType, 'subjectType');
    this.subjectId = assertRequiredString(subjectId, 'subjectId');
    this.organizationId = organizationId;
    this.payload = payload;
    this.occurredAt = occurredAt;
  }
}
