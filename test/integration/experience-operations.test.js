import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import { createTotpCode } from '../../src/security/totp.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function createTenant(service, suffix = randomUUID().slice(0, 8)) {
  const { account } = await service.registerUser({
    givenName: 'Admin',
    familyName: suffix,
    username: `admin-${suffix}`,
    email: `admin-${suffix}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(account.id, {
    legalName: `École ${suffix}`,
    displayName: suffix,
    internalReference: `ORG-${suffix}`,
    countryCode: 'SN',
    organizationType: 'school'
  });
  const session = await service.createAuthenticationSession(account, onboarding.organization.id);
  return { ...onboarding, token: session.accessToken };
}

async function withServer(service, run) {
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('analytics applies privacy thresholds, calculations and real structured exports', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'analytics');
    const organizationId = tenant.organization.id;
    await service.createOperationalRecord('analyticsConfigurations', {
      organizationId,
      privacyMinimum: 2,
      calculationMethods: { attendance: 'present_or_excused_over_records' },
      allowedDimensions: ['period', 'level', 'class', 'program', 'site', 'subject']
    }, tenant.account.id, 'analytics.configure');
    const personOne = await service.registerPerson({
      givenName: 'A', familyName: 'One', primaryOrganizationId: organizationId
    }, tenant.account.id);
    await service.createLearner({ organizationId, personId: personOne.id, learnerNumber: 'A-1' }, tenant.account.id);
    assert.equal(service.buildAnalytics({ organizationId }).privacy.suppressed, true);

    const personTwo = await service.registerPerson({
      givenName: 'B', familyName: 'Two', primaryOrganizationId: organizationId
    }, tenant.account.id);
    await service.createLearner({ organizationId, personId: personTwo.id, learnerNumber: 'A-2' }, tenant.account.id);
    const report = service.buildAnalytics({ organizationId });
    assert.equal(report.metrics.headcount, 2);
    const csv = service.exportAnalytics({ organizationId, format: 'csv' });
    assert.match(csv.body, /headcount/);
    assert.match(csv.contentType, /text\/csv/);
  } finally {
    await service.close();
  }
});

test('role dashboards expose distinct cards and only permission-backed modules', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'roles');
    const organizationId = tenant.organization.id;
    await service.createOperationalRecord('analyticsConfigurations', {
      organizationId, privacyMinimum: 1
    }, tenant.account.id, 'analytics.configure');
    const teacherPerson = await service.registerPerson({
      givenName: 'T', familyName: 'Teacher', primaryOrganizationId: organizationId
    }, tenant.account.id);
    const teacher = await service.openUserAccount({
      personId: teacherPerson.id,
      username: 'teacher-role',
      email: 'teacher-role@example.edu',
      password: 'correct-horse-battery',
      organizationIds: [organizationId]
    }, tenant.account.id);
    const analyticsPermission = service.findPermissionByCode('analytics.read');
    const role = await service.createRole({
      code: 'teacher',
      name: 'Teacher',
      permissions: [analyticsPermission.code]
    }, tenant.account.id);
    await service.assignRole({
      personId: teacherPerson.id,
      roleId: role.id,
      organizationId
    }, tenant.account.id);
    const adminDashboard = service.getRoleDashboard(tenant.account.id, organizationId);
    const teacherDashboard = service.getRoleDashboard(teacher.id, organizationId);
    assert.equal(adminDashboard.role, 'tenant-admin');
    assert.equal(teacherDashboard.role, 'teacher');
    assert.notDeepEqual(adminDashboard.cards.map((card) => card.metric), teacherDashboard.cards.map((card) => card.metric));
    assert.deepEqual(teacherDashboard.availableModules, ['analytics']);
  } finally {
    await service.close();
  }
});

test('MFA enrollment, TOTP challenge, one-time recovery and secret storage are safe', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'mfa');
    const enrollment = await service.enrollMfa(tenant.account.id);
    const stored = await service.connection.get(
      'SELECT encrypted_secret, recovery_hashes FROM mfa_settings WHERE account_id = ?',
      [tenant.account.id]
    );
    assert.notEqual(stored.encrypted_secret, enrollment.secret);
    assert.equal(stored.recovery_hashes.includes(enrollment.recoveryCodes[0]), false);
    await service.confirmMfa(tenant.account.id, createTotpCode(enrollment.secret));
    await assert.rejects(service.enrollMfa(tenant.account.id), /Current MFA code is required/);

    const login = await service.authenticate({
      username: tenant.account.username,
      password: 'correct-horse-battery',
      organizationId: tenant.organization.id
    });
    assert.equal(login.mfaRequired, true);
    const authenticated = await service.completeMfaChallenge(login.challengeToken, enrollment.recoveryCodes[0]);
    assert.ok(authenticated.accessToken);
    await assert.rejects(
      service.completeMfaChallenge(login.challengeToken, enrollment.recoveryCodes[0]),
      /MFA code is invalid/
    );
    await service.disableMfa(tenant.account.id, createTotpCode(enrollment.secret));
    const disabled = await service.connection.get(
      'SELECT encrypted_secret, recovery_hashes, state FROM mfa_settings WHERE account_id = ?',
      [tenant.account.id]
    );
    assert.equal(disabled.encrypted_secret, '');
    assert.equal(disabled.recovery_hashes, '[]');
    assert.equal(disabled.state, 'disabled');
  } finally {
    await service.close();
  }
});

test('authentication rate limiting blocks brute-force bursts', async () => {
  const previousLimit = process.env.AUTH_RATE_LIMIT_MAX;
  const previousWindow = process.env.AUTH_RATE_LIMIT_WINDOW_MS;
  process.env.AUTH_RATE_LIMIT_MAX = '1';
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    await withServer(service, async (baseUrl) => {
      const headers = { 'content-type': 'application/json', 'x-remote-addr': `test-${randomUUID()}` };
      const body = JSON.stringify({ username: 'missing', password: 'wrong-password' });
      assert.equal((await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers, body })).status, 400);
      assert.equal((await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers, body })).status, 429);
    });
  } finally {
    if (previousLimit === undefined) delete process.env.AUTH_RATE_LIMIT_MAX;
    else process.env.AUTH_RATE_LIMIT_MAX = previousLimit;
    if (previousWindow === undefined) delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
    else process.env.AUTH_RATE_LIMIT_WINDOW_MS = previousWindow;
    await service.close();
  }
});

test('offline policy enforces confirmation, conflict detection and idempotency', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'offline');
    const otherTenant = await createTenant(service, 'offline-other');
    const organizationId = tenant.organization.id;
    const ticket = await service.createOperationalRecord('supportTickets', {
      organizationId, subject: 'Connexion', description: 'Intermittente'
    }, tenant.account.id, 'support.create');
    const result = await service.processOfflineMutations({
      organizationId,
      mutations: [
        { idempotencyKey: 'official-1', resource: 'grades', action: 'create', payload: {} },
        { idempotencyKey: 'conflict-1', resource: 'supportTickets', entityId: ticket.id, action: 'comment', expectedUpdatedAt: 'stale', payload: { message: 'Test' } },
        { idempotencyKey: 'comment-1', resource: 'supportTickets', entityId: ticket.id, action: 'comment', expectedUpdatedAt: String(ticket.updatedAt), payload: { message: 'En attente' } }
      ]
    }, tenant.account.id);
    assert.deepEqual(result.results.map((item) => item.state), ['requires_online_confirmation', 'conflict', 'applied']);
    const replay = await service.processOfflineMutations({
      organizationId,
      mutations: [{ idempotencyKey: 'comment-1', resource: 'supportTickets', entityId: ticket.id, action: 'comment', payload: { message: 'Doublon' } }]
    }, tenant.account.id);
    assert.equal(replay.results[0].replayed, true);
    assert.equal(service.supportTickets.get(ticket.id).comments.length, 1);
    const crossTenant = await service.processOfflineMutations({
      organizationId: otherTenant.organization.id,
      mutations: [{ idempotencyKey: 'cross-1', resource: 'supportTickets', entityId: ticket.id, action: 'comment', payload: { message: 'Interdit' } }]
    }, otherTenant.account.id);
    assert.equal(crossTenant.results[0].reason, 'cross_tenant_resource');
  } finally {
    await service.close();
  }
});

test('backup, support, entitlements and AI guardrails preserve external boundaries', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    const tenant = await createTenant(service, 'ops');
    const organizationId = tenant.organization.id;
    const backup = await service.requestBackup({ organizationId, operationType: 'backup' }, tenant.account.id);
    assert.equal(backup.operationState, 'pending_external');

    const ticket = await service.createOperationalRecord('supportTickets', {
      organizationId, subject: 'Aide', description: 'Besoin assistance', supportLevel: 'L1'
    }, tenant.account.id, 'support.create');
    const updatedTicket = await service.addSupportComment(ticket.id, {
      message: 'Escalade', supportLevel: 'L2', ticketState: 'in_progress'
    }, tenant.account.id);
    assert.equal(updatedTicket.comments.length, 1);
    assert.equal(updatedTicket.supportLevel, 'L2');

    const plan = await service.createOperationalRecord('saasPlans', {
      organizationId, code: 'STANDARD', features: ['analytics'], userQuota: 1, storageQuotaBytes: 1000
    }, tenant.account.id, 'saas-plan.create');
    await service.createOperationalRecord('tenantSubscriptions', {
      organizationId, planId: plan.id, subscriptionState: 'active'
    }, tenant.account.id, 'saas-subscription.create');
    assert.equal(service.checkEntitlement(organizationId, 'analytics').allowed, true);
    assert.equal(service.checkEntitlement(organizationId, 'analytics', { additionalUsers: 1 }).reason, 'user_quota_exceeded');

    await assert.rejects(
      service.requestAiAssistance({
        organizationId, requestedAction: 'FINAL-GRADE', prompt: 'Décider', consent: true
      }, tenant.account.id),
      /high-impact/
    );
    const assistance = await service.requestAiAssistance({
      organizationId, requestedAction: 'summarize', prompt: 'Résumer ce cours', consent: true
    }, tenant.account.id);
    assert.equal(assistance.assistanceState, 'pending_external');
    assert.equal(assistance.decisionAuthority, 'human');
  } finally {
    await service.close();
  }
});

test('health, readiness, metrics and accessible offline shell expose no secrets', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  try {
    await withServer(service, async (baseUrl) => {
      const [health, readiness, metrics, page, css, worker, manifest] = await Promise.all([
        fetch(`${baseUrl}/healthz`),
        fetch(`${baseUrl}/readyz`),
        fetch(`${baseUrl}/metrics`),
        fetch(`${baseUrl}/`),
        fetch(`${baseUrl}/styles.css`),
        fetch(`${baseUrl}/service-worker.js`),
        fetch(`${baseUrl}/manifest.webmanifest`)
      ]);
      assert.equal(health.status, 200);
      assert.equal(readiness.status, 200);
      const metricsText = await metrics.text();
      assert.match(metricsText, /eduplateforme_active_sessions/);
      assert.doesNotMatch(metricsText, /password|secret|token|DATABASE_URL/i);
      const html = await page.text();
      assert.match(html, /class="skip-link"/);
      assert.match(html, /lang="fr"/);
      assert.match(await css.text(), /prefers-reduced-motion/);
      assert.match(await worker.text(), /CACHE_VERSION/);
      assert.equal((await manifest.json()).display, 'standalone');
    });
  } finally {
    await service.close();
  }
});

test('PostgreSQL async persistence reloads final operational records', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const databaseUrl = 'postgresql://memory/experience';
  const connection = await createPostgresConnection(databaseUrl, { Pool });
  const service = await initializePersistentEducationPlatformService({ connection });
  const tenant = await createTenant(service, 'pg-ops');
  const ticket = await service.createOperationalRecord('supportTickets', {
    organizationId: tenant.organization.id,
    subject: 'Persisté',
    description: 'Ticket PostgreSQL'
  }, tenant.account.id, 'support.create');
  await service.addSupportComment(ticket.id, { message: 'Persisted async update' }, tenant.account.id);
  assert.equal((await service.repositories.supportTickets.get(ticket.id)).subject, 'Persisté');
  assert.equal((await service.repositories.supportTickets.get(ticket.id)).comments.length, 1);
  await service.close();

  const reloadedConnection = await createPostgresConnection(databaseUrl, { Pool });
  const reloaded = await initializePersistentEducationPlatformService({ connection: reloadedConnection });
  try {
    assert.equal(reloaded.supportTickets.get(ticket.id).description, 'Ticket PostgreSQL');
    assert.equal(reloaded.supportTickets.get(ticket.id).comments[0].message, 'Persisted async update');
  } finally {
    await reloaded.close();
  }
});
