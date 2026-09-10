import {
  createAccountId,
  createLearnerId,
  createPersonId,
  createRoleAssignmentId
} from './identifiers.js';

export function createPerson({ personId = createPersonId(), legalName, birthDate = null }) {
  return {
    personId,
    legalName,
    birthDate
  };
}

export function createLoginAccount({
  accountId = createAccountId(),
  personId,
  username,
  email,
  status = 'active'
}) {
  return {
    accountId,
    personId,
    username,
    email,
    status
  };
}

export function createEducationalRoleAssignment({
  roleAssignmentId = createRoleAssignmentId(),
  personId,
  organizationId,
  role,
  startsOn,
  endsOn = null
}) {
  return {
    roleAssignmentId,
    personId,
    organizationId,
    role,
    startsOn,
    endsOn
  };
}

export function createLearnerProfile({ learnerId = createLearnerId(), personId, curriculumCode = null }) {
  return {
    learnerId,
    personId,
    curriculumCode
  };
}
