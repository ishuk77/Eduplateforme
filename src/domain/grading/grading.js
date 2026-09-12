import { Entity, assertRequiredString } from '../../shared/entity.js';
import { GRADE_FORMATS } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class GradingSystem extends Entity {
  constructor({ id, organizationId, name, format = '/20', passingThreshold = null }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.name = assertRequiredString(name, 'name');
    if (!GRADE_FORMATS.includes(format)) {
      throw new ValidationError(`Unsupported grading format: ${format}`);
    }

    this.format = format;
    this.passingThreshold = passingThreshold;
  }
}

export class GradeEntry extends Entity {
  constructor({ id, organizationId, learnerId, assignmentId = null, score, maxScore = 20, coefficient = 1, version = 1, gradedAt = null, createdAt, updatedAt, archivedAt }) {
    super({ id, createdAt, updatedAt, archivedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.assignmentId = assignmentId;
    this.score = Number(score);
    this.maxScore = Number(maxScore);
    this.coefficient = Number(coefficient);
    this.version = Number(version);
    this.gradedAt = gradedAt ?? updatedAt ?? createdAt ?? new Date().toISOString();
  }

  get normalizedScore() {
    if (this.maxScore <= 0) {
      return 0;
    }

    return (this.score / this.maxScore) * 20;
  }

  get weightedScore() {
    return this.normalizedScore * this.coefficient;
  }
}
