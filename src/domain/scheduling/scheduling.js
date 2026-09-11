import { Entity, assertRequiredString } from '../../shared/entity.js';

export class ScheduleEntry extends Entity {
  constructor({ id, organizationId, classId, subject, teacherPersonId, dayOfWeek, startsAt, endsAt }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.classId = assertRequiredString(classId, 'classId');
    this.subject = assertRequiredString(subject, 'subject');
    this.teacherPersonId = assertRequiredString(teacherPersonId, 'teacherPersonId');
    this.dayOfWeek = assertRequiredString(dayOfWeek, 'dayOfWeek');
    this.startsAt = assertRequiredString(startsAt, 'startsAt');
    this.endsAt = assertRequiredString(endsAt, 'endsAt');
  }
}
