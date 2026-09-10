import {
  Entity,
  ValidationError,
  assertArray,
  assertOptionalString,
  assertRequiredString
} from '../../shared/entity.js';

export class Permission extends Entity {
  constructor({ id, code, description }) {
    super({ id });
    this.code = assertRequiredString(code, 'code');
    this.description = assertRequiredString(description, 'description');
  }
}

export class Role extends Entity {
  constructor({ id, code, name, permissions = [], scope = 'organization' }) {
    super({ id });
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
    this.scope = assertRequiredString(scope, 'scope');
    this.permissions = assertArray(permissions, 'permissions');
  }
}

export class RoleAssignment extends Entity {
  constructor({ id, personId, roleId, organizationId, assignedAt = new Date(), endsAt = null }) {
    super({ id, createdAt: assignedAt, updatedAt: assignedAt });
    this.personId = assertRequiredString(personId, 'personId');
    this.roleId = assertRequiredString(roleId, 'roleId');
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.assignedAt = assignedAt;
    this.endsAt = endsAt;
  }

  end(at = new Date()) {
    this.endsAt = at;
    this.touch(at);
  }
}

export class PermissionGrant extends Entity {
  constructor({
    id,
    permissionId,
    organizationId,
    personId = null,
    accountId = null,
    reason,
    grantedAt = new Date(),
    expiresAt = null
  }) {
    super({ id, createdAt: grantedAt, updatedAt: grantedAt });
    this.permissionId = assertRequiredString(permissionId, 'permissionId');
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertOptionalString(personId, 'personId');
    this.accountId = assertOptionalString(accountId, 'accountId');
    this.reason = assertRequiredString(reason, 'reason');
    this.expiresAt = expiresAt;
    this.revokedAt = null;

    if ((this.personId === null && this.accountId === null) || (this.personId !== null && this.accountId !== null)) {
      throw new ValidationError('PermissionGrant must target exactly one of personId or accountId.');
    }
  }

  revoke(at = new Date()) {
    this.status = 'revoked';
    this.revokedAt = at;
    this.touch(at);
  }
}
