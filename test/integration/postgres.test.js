import assert from 'node:assert/strict';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
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

test('PostgreSQL learner creation awaits commit and returns the created record', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const connection = await createPostgresConnection('postgresql://memory/learner-route', { Pool });
  const service = await initializePersistentEducationPlatformService({ connection });
  const server = createHttpServer({ foundation: service });

  try {
    const { account } = await service.registerUser({
      givenName: 'Async',
      familyName: 'Admin',
      username: 'async-admin',
      email: 'async@example.edu',
      password: 'super-secret-password'
    });
    const onboarding = await service.onboardAccount(account.id, {
      legalName: 'Async School',
      displayName: 'Async',
      internalReference: 'ASYNC-001',
      countryCode: 'SN',
      organizationType: 'school'
    });
    const authentication = await service.createAuthenticationSession(
      account,
      onboarding.organization.id
    );

    await new Promise((resolve) => server.listen(0, resolve));
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/academics/learners`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${authentication.accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: onboarding.organization.id,
          personId: onboarding.person.id,
          learnerNumber: 'ASYNC-LRN-001'
        })
      }
    );
    assert.equal(response.status, 201);
    const learner = await response.json();
    assert.ok(learner.id);
    assert.equal(learner.learnerNumber, 'ASYNC-LRN-001');
    assert.equal(
      (await service.repositories.learners.get(learner.id)).learnerNumber,
      'ASYNC-LRN-001'
    );
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
      );
    }
    await service.close();
  }
});
