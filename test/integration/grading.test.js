import test from 'node:test';
import assert from 'node:assert/strict';
import { createEducationPlatformService } from '../../src/services/education-platform-service.js';

function setupAcademicBase(service) {
  const org = service.createOrganization({
    legalName: 'Ecole Sigma',
    displayName: 'Sigma',
    internalReference: 'ORG-SIGMA',
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-SIGMA'
  });
  const student = service.registerPerson({ givenName: 'Lina', familyName: 'Dia', primaryOrganizationId: org.id });
  const teacher = service.registerPerson({ givenName: 'Prof', familyName: 'Math', primaryOrganizationId: org.id });
  const learner = service.createLearner({ organizationId: org.id, personId: student.id, learnerNumber: 'LRN-1' });
  const year = service.createAcademicYear({ organizationId: org.id, code: '2026-2027', name: 'AY', startsOn: '2026-09-01', endsOn: '2027-06-30' });
  const program = service.createProgram({ organizationId: org.id, academicYearId: year.id, code: 'SCI', name: 'Science' });
  const klass = service.createClass({ organizationId: org.id, academicYearId: year.id, programId: program.id, code: 'SCI-A', name: 'SCI A' });
  service.createEnrollment({ learnerId: learner.id, organizationId: org.id, personId: student.id, classId: klass.id, academicYearId: year.id });
  return { org, teacher, learner, klass };
}

test('grading supports coefficients and grade versioning', () => {
  const service = createEducationPlatformService();
  const { org, learner, klass } = setupAcademicBase(service);

  service.configureGradingSystem({ organizationId: org.id, name: 'General', format: '/20' });
  const assignment = service.createAssignment({ organizationId: org.id, classId: klass.id, title: 'Quiz 1', type: 'quiz', dueAt: '2026-10-10T10:00:00Z' });
  const g1 = service.recordGrade({ organizationId: org.id, learnerId: learner.id, assignmentId: assignment.id, score: 12, maxScore: 20, coefficient: 2 });
  const g2 = service.recordGrade({ organizationId: org.id, learnerId: learner.id, assignmentId: assignment.id, score: 16, maxScore: 20, coefficient: 2 });

  assert.equal(g1.version, 1);
  assert.equal(g2.version, 2);
  assert.equal(service.calculateLearnerAverage({ organizationId: org.id, learnerId: learner.id }).averageOn20, 14);
});
