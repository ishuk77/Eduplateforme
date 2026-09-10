import { Entity, assertRequiredString } from '../../shared/entity.js';

export class AcademicYear extends Entity {
  constructor({ id, organizationId, code, name, startsOn, endsOn }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
    this.startsOn = startsOn;
    this.endsOn = endsOn;
  }
}

export class Program extends Entity {
  constructor({ id, organizationId, academicYearId, code, name, cycle = null }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.academicYearId = assertRequiredString(academicYearId, 'academicYearId');
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
    this.cycle = cycle;
  }
}

export class LearningClass extends Entity {
  constructor({ id, organizationId, academicYearId, programId, code, name }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.academicYearId = assertRequiredString(academicYearId, 'academicYearId');
    this.programId = assertRequiredString(programId, 'programId');
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
  }
}

export class Enrollment extends Entity {
  constructor({
    id,
    organizationId,
    personId,
    classId,
    academicYearId,
    status = 'proposed',
    enrolledAt = new Date(),
    withdrawnAt = null
  }) {
    super({ id, status, createdAt: enrolledAt, updatedAt: enrolledAt });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.classId = assertRequiredString(classId, 'classId');
    this.academicYearId = assertRequiredString(academicYearId, 'academicYearId');
    this.enrolledAt = enrolledAt;
    this.withdrawnAt = withdrawnAt;
  }

  confirm(at = new Date()) {
    this.status = 'active';
    this.touch(at);
  }

  withdraw(at = new Date()) {
    this.status = 'withdrawn';
    this.withdrawnAt = at;
    this.touch(at);
  }
}
