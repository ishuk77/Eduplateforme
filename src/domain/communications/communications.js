import { Entity, assertRequiredString } from '../../shared/entity.js';

export class DiscussionThread extends Entity {
  constructor({ id, organizationId, scope, title, moderationLevel = 'standard' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.scope = assertRequiredString(scope, 'scope');
    this.title = assertRequiredString(title, 'title');
    this.moderationLevel = assertRequiredString(moderationLevel, 'moderationLevel');
  }
}

export class ThreadMessage extends Entity {
  constructor({ id, organizationId, threadId, authorPersonId, content }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.threadId = assertRequiredString(threadId, 'threadId');
    this.authorPersonId = assertRequiredString(authorPersonId, 'authorPersonId');
    this.content = assertRequiredString(content, 'content');
  }
}
