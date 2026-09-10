import { randomUUID } from 'node:crypto';

function createOpaqueId() {
  return randomUUID();
}

export function createPersonId() {
  return createOpaqueId();
}

export function createAccountId() {
  return createOpaqueId();
}

export function createRoleAssignmentId() {
  return createOpaqueId();
}

export function createOrganizationId() {
  return createOpaqueId();
}

export function createLearnerId() {
  return createOpaqueId();
}

export function createEnrollmentId() {
  return createOpaqueId();
}

export function createAuthorizationId() {
  return createOpaqueId();
}

export function createAccreditationId() {
  return createOpaqueId();
}

export function createDocumentId() {
  return createOpaqueId();
}

export function createDocumentVersionId() {
  return createOpaqueId();
}
