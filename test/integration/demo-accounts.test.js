import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpServer } from '../../src/http/server.js';
import { createPersistentEducationPlatformService } from '../../src/services/persistent-education-platform-service.js';

async function createTenant(service, suffix) {
  const { account } = await service.registerUser({
    givenName: 'Admin',
    familyName: suffix,
    username: `admin-${suffix}`,
    email: `admin-${suffix}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(account.id, {
    legalName: `Institution ${suffix}`,
    displayName: suffix,
    internalReference: `ORG-${suffix}`,
    countryCode: 'SN',
    organizationType: 'school',
    locale: 'fr'
  });
  return { account, organization: onboarding.organization };
}

async function login(service, account, organizationId) {
  return (await service.createAuthenticationSession(account, organizationId)).accessToken;
}

async function request(baseUrl, path, { token, body, expected }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, expected);
  return response.json();
}

test('tenant admin provisions idempotent, forced-change dashboard accounts without cross-tenant access', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = createHttpServer({ foundation: service });
  try {
    const tenant = await createTenant(service, 'preview');
    const outsider = await createTenant(service, 'outsider');
    const token = await login(service, tenant.account, tenant.organization.id);
    await new Promise((resolve) => server.listen(0, resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const created = await request(baseUrl, '/operations/demo-accounts/provision', {
      token,
      body: { organizationId: tenant.organization.id },
      expected: 201
    });
    assert.deepEqual(created.accounts.map((account) => account.roleCode), [
      'learner', 'student', 'teacher', 'platform-admin'
    ]);
    assert.equal(created.credentials.length, 4);
    assert.ok(created.accounts.every((account) => account.created));

    const credential = created.credentials.find((item) => item.roleCode === 'learner');
    const credentialRow = service.connection.get(
      'SELECT password_hash FROM auth_credentials WHERE account_id = ?',
      [created.accounts.find((item) => item.roleCode === 'learner').accountId]
    );
    assert.ok(credentialRow.password_hash);
    assert.equal(credentialRow.password_hash.includes(credential.temporaryPassword), false);
    const firstLogin = await service.authenticate({
      username: credential.username,
      password: credential.temporaryPassword,
      organizationId: tenant.organization.id
    });
    assert.equal(firstLogin.passwordChangeRequired, true);

    const dashboards = new Map(created.accounts.map((preview) => [
      preview.roleCode,
      service.getRoleDashboard(preview.accountId, tenant.organization.id)
    ]));
    for (const roleCode of ['learner', 'student', 'teacher', 'platform-admin']) {
      assert.equal(dashboards.get(roleCode).role, roleCode);
    }
    assert.notDeepEqual(dashboards.get('learner').availableModules, dashboards.get('teacher').availableModules);
    assert.notDeepEqual(dashboards.get('student').nextSteps, dashboards.get('platform-admin').nextSteps);
    const platformAccount = service.accounts.get(
      created.accounts.find((item) => item.roleCode === 'platform-admin').accountId
    );
    assert.deepEqual(platformAccount.organizationIds, [tenant.organization.id]);
    assert.deepEqual(service.getAccountPermissions(platformAccount.id, outsider.organization.id), []);

    const replay = await request(baseUrl, '/operations/demo-accounts/provision', {
      token,
      body: { organizationId: tenant.organization.id },
      expected: 201
    });
    assert.ok(replay.accounts.every((account) => !account.created));
    assert.deepEqual(replay.credentials, []);
    assert.deepEqual(
      replay.accounts.map((account) => account.accountId),
      created.accounts.map((account) => account.accountId)
    );

    await request(baseUrl, '/operations/demo-accounts/provision', {
      token,
      body: { organizationId: outsider.organization.id },
      expected: 403
    });

    const learnerToken = await login(service, service.accounts.get(created.accounts[0].accountId), tenant.organization.id);
    await request(baseUrl, '/operations/demo-accounts/provision', {
      token: learnerToken,
      body: { organizationId: tenant.organization.id },
      expected: 403
    });

    const auditRows = service.connection.all(
      `SELECT action FROM audit_trail
       WHERE organization_id = ? AND action LIKE '%preview-account-create'`,
      [tenant.organization.id]
    );
    assert.ok(auditRows.length >= 12);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
});
