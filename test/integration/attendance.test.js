import test from 'node:test';
import assert from 'node:assert/strict';
import { createEducationPlatformService } from '../../src/services/education-platform-service.js';

function setup(service) {
  const org = service.createOrganization({ legalName: 'Ecole Tera', displayName: 'Tera', internalReference: 'ORG-TERA', countryCode: 'SN', nationalInstitutionId: 'NAT-TERA' });
  const student = service.registerPerson({ givenName: 'Ami', familyName: 'Lo', primaryOrganizationId: org.id });
  const teacher = service.registerPerson({ givenName: 'Ibra', familyName: 'Ly', primaryOrganizationId: org.id });
  const learner = service.createLearner({ organizationId: org.id, personId: student.id, learnerNumber: 'LRN-T1' });
  const year = service.createAcademicYear({ organizationId: org.id, code: '2026-2027', name: 'AY', startsOn: '2026-09-01', endsOn: '2027-06-30' });
  const program = service.createProgram({ organizationId: org.id, academicYearId: year.id, code: 'GEN', name: 'General' });
  const klass = service.createClass({ organizationId: org.id, academicYearId: year.id, programId: program.id, code: 'GEN-1', name: 'GEN 1' });
  return { org, learner, klass, teacher };
}

test('attendance computes rate and triggers absence notification', () => {
  const service = createEducationPlatformService();
  const { org, learner, klass } = setup(service);

  service.recordAttendance({ organizationId: org.id, learnerId: learner.id, classId: klass.id, date: '2026-09-15', status: 'present' });
  service.recordAttendance({ organizationId: org.id, learnerId: learner.id, classId: klass.id, date: '2026-09-16', status: 'absent' });

  const rate = service.getAttendanceRate({ organizationId: org.id, learnerId: learner.id });
  assert.equal(rate.rate, 50);
  assert.equal(Array.from(service.notifications.values()).length, 1);
});
