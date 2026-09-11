import { Entity, assertRequiredString } from '../../shared/entity.js';
import { NOTIFICATION_CHANNELS } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class Notification extends Entity {
  constructor({ id, organizationId, eventType, channel, recipientId, payload = {} }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.eventType = assertRequiredString(eventType, 'eventType');
    if (!NOTIFICATION_CHANNELS.includes(channel)) {
      throw new ValidationError(`Unsupported notification channel: ${channel}`);
    }

    this.channel = channel;
    this.recipientId = assertRequiredString(recipientId, 'recipientId');
    this.payload = payload;
    this.sentAt = null;
  }

  markSent(at = new Date().toISOString()) {
    this.sentAt = at;
  }
}
