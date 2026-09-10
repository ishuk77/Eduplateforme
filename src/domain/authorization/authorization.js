import { Entity, assertArray, assertRequiredString } from '../../shared/entity.js';

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
