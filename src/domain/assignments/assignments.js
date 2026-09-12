import { Entity, assertOptionalString, assertRequiredString } from '../../shared/entity.js';
import { ASSIGNMENT_TYPES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class Assignment extends Entity {
  constructor({
    id, organizationId, classId, courseId = null, title, type = 'homework', dueAt,
    status = 'published', recipientLearnerIds = [], publishedAt = null, legacyRecipientScope = false,
    createdAt, updatedAt, archivedAt
  }) {
    super({ id, status, createdAt, updatedAt, archivedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.classId = assertRequiredString(classId, 'classId');
    this.courseId = assertOptionalString(courseId, 'courseId');
    this.title = assertRequiredString(title, 'title');
    if (!ASSIGNMENT_TYPES.includes(type)) {
      throw new ValidationError(`Unsupported assignment type: ${type}`);
    }

    this.type = type;
    this.dueAt = assertRequiredString(dueAt, 'dueAt');
    this.recipientLearnerIds = Array.isArray(recipientLearnerIds) ? [...new Set(recipientLearnerIds)] : [];
    this.publishedAt = publishedAt;
    this.legacyRecipientScope = legacyRecipientScope === true;
    this.version = 1;
  }
}

export class AssignmentSubmission extends Entity {
  constructor({
    id, organizationId, assignmentId, learnerId, submittedAt = new Date().toISOString(),
    contentReference, score = null, maxScore = null, status, createdAt, updatedAt, archivedAt
  }) {
    super({ id, status, createdAt, updatedAt, archivedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.assignmentId = assertRequiredString(assignmentId, 'assignmentId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.submittedAt = submittedAt;
    this.contentReference = assertRequiredString(contentReference, 'contentReference');
    this.score = score == null ? null : Number(score);
    this.maxScore = maxScore == null ? null : Number(maxScore);
  }
}
