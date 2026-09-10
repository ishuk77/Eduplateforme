import { Entity, assertRequiredString } from '../../shared/entity.js';

export class UserAccount extends Entity {
  constructor({
    id,
    personId,
    username,
    email,
    authProvider = 'local',
    lastLoginAt = null,
    lifecycle = {}
  }) {
    super({ id, status: lifecycle.status ?? 'pending_activation' });
    this.personId = assertRequiredString(personId, 'personId');
    this.username = assertRequiredString(username, 'username');
    this.email = assertRequiredString(email, 'email').toLowerCase();
    this.authProvider = assertRequiredString(authProvider, 'authProvider');
    this.lastLoginAt = lastLoginAt;
    this.deactivatedAt = lifecycle.deactivatedAt ?? null;
  }

  activate(at = new Date()) {
    this.status = 'active';
    this.deactivatedAt = null;
    this.touch(at);
  }

  deactivate(at = new Date()) {
    this.status = 'inactive';
    this.deactivatedAt = at;
    this.touch(at);
  }
}
