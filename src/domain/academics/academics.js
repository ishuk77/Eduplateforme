import {
  Entity,
  assertOptionalString,
  assertPlainObject,
  assertRequiredString
} from '../../shared/entity.js';

export class Learner extends Entity {
  constructor({
    id,
    organizationId,
    personId,
    learnerNumber = null,
    nationalLearnerId = null,
    preferredProgramId = null,
    metadata = {},
    lifecycle = {}
  }) {
    super({ id, status: lifecycle.status ?? 'prospect' });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.learnerNumber = assertOptionalString(learnerNumber, 'learnerNumber');
    this.nationalLearnerId = assertOptionalString(nationalLearnerId, 'nationalLearnerId');
    this.preferredProgramId = assertOptionalString(preferredProgramId, 'preferredProgramId');
    this.metadata = assertPlainObject(metadata, 'metadata');
  }
}

export class AcademicYear extends Entity {
  constructor({ id, organizationId, code, name, startsOn, endsOn, calendarSystem = 'gregorian' }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
    this.startsOn = startsOn;
    this.endsOn = endsOn;
    this.calendarSystem = assertRequiredString(calendarSystem, 'calendarSystem');
  }
}

export class Program extends Entity {
  constructor({
    id,
    organizationId,
    academicYearId,
    code,
    name,
    cycle = null,
    awardingOrganizationId = null,
    nationalProgramCode = null
  }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.academicYearId = assertRequiredString(academicYearId, 'academicYearId');
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
    this.cycle = assertOptionalString(cycle, 'cycle');
    this.awardingOrganizationId = assertOptionalString(awardingOrganizationId, 'awardingOrganizationId');
    this.nationalProgramCode = assertOptionalString(nationalProgramCode, 'nationalProgramCode');
  }
}

export class LearningClass extends Entity {
  constructor({ id, organizationId, academicYearId, programId, code, name, levelCode = null, campusId = null }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.academicYearId = assertRequiredString(academicYearId, 'academicYearId');
    this.programId = assertRequiredString(programId, 'programId');
    this.code = assertRequiredString(code, 'code');
    this.name = assertRequiredString(name, 'name');
    this.levelCode = assertOptionalString(levelCode, 'levelCode');
    this.campusId = assertOptionalString(campusId, 'campusId');
  }
}

export class Enrollment extends Entity {
  constructor({
    id,
    learnerId,
    organizationId,
    personId,
    classId,
    academicYearId,
    programId = null,
    enrollmentReference = null,
    status = 'proposed',
    enrolledAt = new Date(),
    withdrawnAt = null
  }) {
    super({ id, status, createdAt: enrolledAt, updatedAt: enrolledAt });
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.personId = assertRequiredString(personId, 'personId');
    this.classId = assertRequiredString(classId, 'classId');
    this.academicYearId = assertRequiredString(academicYearId, 'academicYearId');
    this.programId = assertOptionalString(programId, 'programId');
    this.enrollmentReference = assertOptionalString(enrollmentReference, 'enrollmentReference');
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
