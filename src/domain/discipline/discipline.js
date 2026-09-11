import { Entity, assertRequiredString } from '../../shared/entity.js';

export class DisciplineRecord extends Entity {
  constructor({ id, organizationId, learnerId, type, description, severity = 'medium' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.type = assertRequiredString(type, 'type');
    this.description = assertRequiredString(description, 'description');
    this.severity = assertRequiredString(severity, 'severity');
  }
}
