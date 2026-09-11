import { Entity, assertRequiredString } from '../../shared/entity.js';
import { ASSIGNMENT_TYPES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class Assignment extends Entity {
  constructor({ id, organizationId, classId, title, type = 'homework', dueAt }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.classId = assertRequiredString(classId, 'classId');
    this.title = assertRequiredString(title, 'title');
    if (!ASSIGNMENT_TYPES.includes(type)) {
      throw new ValidationError(`Unsupported assignment type: ${type}`);
    }

    this.type = type;
    this.dueAt = assertRequiredString(dueAt, 'dueAt');
    this.version = 1;
  }
}

export class AssignmentSubmission extends Entity {
  constructor({ id, organizationId, assignmentId, learnerId, submittedAt = new Date().toISOString(), contentReference }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.assignmentId = assertRequiredString(assignmentId, 'assignmentId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.submittedAt = submittedAt;
    this.contentReference = assertRequiredString(contentReference, 'contentReference');
    this.score = null;
    this.maxScore = null;
  }
}
