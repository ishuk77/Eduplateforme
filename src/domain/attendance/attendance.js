import { Entity, assertOptionalString, assertRequiredString } from '../../shared/entity.js';
import { ATTENDANCE_STATUSES } from '../../shared/constants.js';
import { ValidationError } from '../../shared/errors.js';

export class AttendanceRecord extends Entity {
  constructor({ id, organizationId, learnerId, classId, courseId = null, date, status, createdAt, updatedAt, archivedAt }) {
    super({ id, createdAt, updatedAt, archivedAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.classId = assertRequiredString(classId, 'classId');
    this.courseId = assertOptionalString(courseId, 'courseId');
    this.date = assertRequiredString(date, 'date');
    if (!ATTENDANCE_STATUSES.includes(status)) {
      throw new ValidationError(`Unsupported attendance status: ${status}`);
    }

    this.status = status;
  }
}
