import { Entity, assertRequiredString } from '../../shared/entity.js';

export class CalendarEvent extends Entity {
  constructor({ id, organizationId, title, eventType, startsAt, endsAt, roleScope = 'all' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.title = assertRequiredString(title, 'title');
    this.eventType = assertRequiredString(eventType, 'eventType');
    this.startsAt = assertRequiredString(startsAt, 'startsAt');
    this.endsAt = assertRequiredString(endsAt, 'endsAt');
    this.roleScope = assertRequiredString(roleScope, 'roleScope');
  }
}
