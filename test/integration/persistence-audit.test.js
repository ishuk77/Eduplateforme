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
    const discipline = service.recordDiscipline({ organizationId: organization.id, learnerId: learner.id, type: 'incident', description: 'Retard', severity: 'low' }, 'bootstrap');
    service.updateCrudResource('discipline', discipline.id, { severity: 'high', description: 'Retard répété' }, 'bootstrap');
    service.archiveCrudResource('discipline', discipline.id, 'bootstrap');

    reloaded = createPersistentEducationPlatformService({ databaseUrl: url });
    const stored = reloaded.getCrudResource('discipline', discipline.id);
    assert.equal(stored.severity, 'high');
    assert.equal(stored.status, 'archived');

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
