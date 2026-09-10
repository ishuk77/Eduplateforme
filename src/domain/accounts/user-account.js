import {
  Entity,
  assertArray,
  assertOptionalString,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

function normalizeLoginIdentifier(identifier, index) {
  const value = assertPlainObject(identifier, `loginIdentifiers[${index}]`);

  return {
    type: assertRequiredString(value.type, `loginIdentifiers[${index}].type`),
    value: assertRequiredString(value.value, `loginIdentifiers[${index}].value`).toLowerCase(),
    verifiedAt: value.verifiedAt ?? null
  };
}

export class UserAccount extends Entity {
  constructor({
    id,
    personId,
    username,
    email,
    authProvider = 'local',
    loginIdentifiers = [],
    authenticationMethods = [],
    organizationIds = [],
    lastLoginAt = null,
    lifecycle = {}
  }) {
    super({ id, status: lifecycle.status ?? 'pending_activation' });
    this.personId = assertRequiredString(personId, 'personId');
    this.username = assertRequiredString(username, 'username');
    this.email = assertRequiredString(email, 'email').toLowerCase();
    this.authProvider = assertRequiredString(authProvider, 'authProvider');
    this.loginIdentifiers = assertArray(loginIdentifiers, 'loginIdentifiers').length > 0
      ? loginIdentifiers.map(normalizeLoginIdentifier)
      : [
          { type: 'username', value: this.username.toLowerCase(), verifiedAt: null },
          { type: 'email', value: this.email, verifiedAt: null }
        ];
    this.authenticationMethods = assertArray(authenticationMethods, 'authenticationMethods').length > 0
      ? authenticationMethods.map((method, index) => assertRequiredString(method, `authenticationMethods[${index}]`))
      : [this.authProvider];
    this.organizationIds = assertArray(organizationIds, 'organizationIds').map((organizationId, index) =>
      assertRequiredString(organizationId, `organizationIds[${index}]`)
    );
    this.lastLoginAt = lastLoginAt;
    this.deactivatedAt = lifecycle.deactivatedAt ?? null;
    this.metadata = assertPlainObject(lifecycle.metadata ?? {}, 'lifecycle.metadata');
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
