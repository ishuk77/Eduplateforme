import assert from 'node:assert/strict';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import {
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

test('PostgreSQL migrations persist and reload application state', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const databaseUrl = 'postgresql://memory/eduplateforme';
  const firstConnection = await createPostgresConnection(databaseUrl, { Pool });
  const firstService = await initializePersistentEducationPlatformService({ connection: firstConnection });

  const organization = await firstService.createOrganization({
    legalName: 'Ecole PostgreSQL',
    displayName: 'PostgreSQL',
    internalReference: 'ORG-PG',
    countryCode: 'SN',
    nationalInstitutionId: 'NAT-PG'
  }, 'bootstrap');
  const person = await firstService.registerPerson({
    givenName: 'PostgreSQL',
    familyName: 'Admin',
    primaryOrganizationId: organization.id
  }, 'bootstrap');
  await firstService.openUserAccount({
    personId: person.id,
    username: 'postgres-admin',
    email: 'postgres-admin@example.edu',
    password: 'super-secret-password',
    organizationIds: [organization.id]
  }, 'bootstrap');
  const firstLogin = await firstService.authenticate({
    username: 'postgres-admin',
    password: 'super-secret-password',
    organizationId: organization.id
  });
  assert.ok(firstLogin.accessToken);
  assert.deepEqual(await firstService.healthCheck(), {
    status: 'ok',
    database: 'postgres'
  });
  await firstService.close();

  const secondConnection = await createPostgresConnection(databaseUrl, { Pool });
  const secondService = await initializePersistentEducationPlatformService({ connection: secondConnection });
  try {
    assert.equal(secondService.getCrudResource('organizations', organization.id).displayName, 'PostgreSQL');
    const secondLogin = await secondService.authenticate({
      username: 'postgres-admin',
      password: 'super-secret-password',
      organizationId: organization.id
    });
    assert.equal(secondLogin.user.organizationId, organization.id);
    const history = await secondService.getCrudHistory('organizations', organization.id);
    assert.equal(history.items[0].action, 'organization.create');
  } finally {
    await secondService.close();
  }
});
