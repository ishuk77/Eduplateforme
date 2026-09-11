import test from 'node:test';
import assert from 'node:assert/strict';
import { createEducationPlatformService } from '../../src/services/education-platform-service.js';

function setup(service) {
  const org = service.createOrganization({ legalName: 'Ecole Nova', displayName: 'Nova', internalReference: 'ORG-NOVA', countryCode: 'SN', nationalInstitutionId: 'NAT-NOVA' });
  const student = service.registerPerson({ givenName: 'Neo', familyName: 'Fall', primaryOrganizationId: org.id });
  const teacher = service.registerPerson({ givenName: 'Prof', familyName: 'Nova', primaryOrganizationId: org.id });
  const learner = service.createLearner({ organizationId: org.id, personId: student.id, learnerNumber: 'LRN-N1' });
  const year = service.createAcademicYear({ organizationId: org.id, code: '2026-2027', name: 'AY', startsOn: '2026-09-01', endsOn: '2027-06-30' });
  const program = service.createProgram({ organizationId: org.id, academicYearId: year.id, code: 'GEN', name: 'General' });
  const klass = service.createClass({ organizationId: org.id, academicYearId: year.id, programId: program.id, code: 'GEN-X', name: 'GEN X' });
  return { org, learner, klass, teacher };
}

test('assignment submission grading creates grade and supports late tracking', () => {
  const service = createEducationPlatformService();
  const { org, learner, klass } = setup(service);

  const assignment = service.createAssignment({ organizationId: org.id, classId: klass.id, title: 'Exercice 1', type: 'exercise', dueAt: '2026-09-10T12:00:00Z' });
  const submission = service.submitAssignment({ organizationId: org.id, assignmentId: assignment.id, learnerId: learner.id, submittedAt: '2026-09-10T13:00:00Z', contentReference: 's3://submission-1' });
  const grade = service.gradeSubmission(submission.id, { score: 18, maxScore: 20, coefficient: 1 });

  assert.equal(grade.assignmentId, assignment.id);
  assert.equal(service.assignmentSubmissions.get(submission.id).score, 18);
  assert.ok(service.events.some((event) => event.type === 'assignments.submission.late'));
});
