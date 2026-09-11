import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createPersistentEducationPlatformService } from '../../src/services/persistent-education-platform-service.js';

function createDatabaseUrl() {
  const directory = mkdtempSync(join(tmpdir(), 'eduplateforme-'));
  return {
    directory,
    url: `sqlite:${join(directory, 'eduplateforme.sqlite')}`
  };
}

test('persistent service reloads records, keeps history, and writes audit entries', async () => {
  const { directory, url } = createDatabaseUrl();
  let service;
  let reloaded;
  try {
    service = createPersistentEducationPlatformService({ databaseUrl: url });
    const organization = service.createOrganization({
      legalName: 'Ecole Persist',
      displayName: 'Persist',
      internalReference: 'ORG-PERSIST',
      countryCode: 'SN',
      nationalInstitutionId: 'NAT-PERSIST'
    }, 'bootstrap');
    const person = service.registerPerson({ givenName: 'Nina', familyName: 'Fall', primaryOrganizationId: organization.id }, 'bootstrap');
    const learner = service.createLearner({ organizationId: organization.id, personId: person.id, learnerNumber: 'LRN-PERSIST' }, 'bootstrap');
    const teacher = service.registerPerson({ givenName: 'Moussa', familyName: 'Ndiaye', primaryOrganizationId: organization.id }, 'bootstrap');
    const year = service.createAcademicYear({ organizationId: organization.id, code: '2026-2027', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30' }, 'bootstrap');
    const program = service.createProgram({ organizationId: organization.id, academicYearId: year.id, code: 'GEN', name: 'Général' }, 'bootstrap');
    const learningClass = service.createClass({ organizationId: organization.id, academicYearId: year.id, programId: program.id, code: 'GEN-A', name: 'Général A' }, 'bootstrap');
    const assignment = service.createAssignment({ organizationId: organization.id, classId: learningClass.id, title: 'Persistance', dueAt: '2026-10-01T12:00:00Z' }, 'bootstrap');
    const submission = service.submitAssignment({ organizationId: organization.id, assignmentId: assignment.id, learnerId: learner.id, contentReference: 'storage://submission' }, 'bootstrap');
    service.gradeSubmission(submission.id, { score: 17, maxScore: 20 }, 'bootstrap');
    service.archiveCrudResource('assignmentSubmissions', submission.id, 'bootstrap');
    const notification = service.createNotification({ organizationId: organization.id, eventType: 'persistence.check', channel: 'internal', recipientId: teacher.id }, 'bootstrap');
    service.markNotificationSent(notification.id, 'bootstrap');
    const discipline = service.recordDiscipline({ organizationId: organization.id, learnerId: learner.id, type: 'incident', description: 'Retard', severity: 'low' }, 'bootstrap');
    service.updateCrudResource('discipline', discipline.id, { severity: 'high', description: 'Retard répété' }, 'bootstrap');
    service.archiveCrudResource('discipline', discipline.id, 'bootstrap');

    reloaded = createPersistentEducationPlatformService({ databaseUrl: url });
    const stored = reloaded.getCrudResource('discipline', discipline.id);
    assert.equal(stored.severity, 'high');
    assert.equal(stored.status, 'archived');
    const storedSubmission = reloaded.getCrudResource('assignmentSubmissions', submission.id);
    assert.equal(storedSubmission.score, 17);
    assert.equal(storedSubmission.maxScore, 20);
    assert.equal(storedSubmission.status, 'archived');
    assert.ok(storedSubmission.archivedAt);
    assert.ok(reloaded.getCrudResource('notifications', notification.id).sentAt);
    assert.throws(
      () => reloaded.updateCrudResource('assignmentSubmissions', submission.id, { assignmentId: 'cross-tenant-assignment' }, 'bootstrap'),
      /assignmentId cannot be changed/
    );

    const history = reloaded.getCrudHistory('discipline', discipline.id);
    assert.equal(history.items.length, 3);
    assert.equal(history.items[0].action, 'discipline.archive');

    const audit = reloaded.getAuditTrail({ organizationId: organization.id });
    assert.ok(audit.items.some((entry) => entry.action === 'discipline.update'));
    assert.ok(audit.items.some((entry) => entry.action === 'discipline.archive'));
  } finally {
    await reloaded?.close();
    await service?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
