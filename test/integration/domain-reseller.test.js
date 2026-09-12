import assert from 'node:assert/strict';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createApp } from '../../src/http/app.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';
import {
  createDomainProvider,
  FakeDomainProvider,
  OpenproviderDomainProvider
} from '../../src/services/domain-provider.js';

async function createTenant(service, suffix) {
  const registration = await service.registerUser({
    givenName: 'Domain',
    familyName: suffix,
    username: `domain-${suffix.toLowerCase()}`,
    email: `domain-${suffix.toLowerCase()}@example.edu`,
    password: 'correct-horse-battery'
  });
  const onboarding = await service.onboardAccount(registration.account.id, {
    legalName: `Domain ${suffix}`,
    displayName: `Domain ${suffix}`,
    countryCode: 'SN',
    organizationType: 'school'
  });
  const session = await service.createAuthenticationSession(
    registration.account,
    onboarding.organization.id
  );
  return { ...onboarding, account: registration.account, token: session.accessToken };
}

async function addRole(service, tenant, code) {
  let role = [...service.roles.values()].find((entry) => entry.code === code);
  if (!role) {
    role = await service.createRole({
      code,
      name: code,
      scope: 'organization',
      permissions: []
    }, 'bootstrap');
  }
  await service.assignRole({
    personId: tenant.person.id,
    roleId: role.id,
    organizationId: tenant.organization.id
  }, 'bootstrap');
  const session = await service.createAuthenticationSession(tenant.account, tenant.organization.id);
  return session.accessToken;
}

async function seedQuote(service, organizationId, suffix = 'one') {
  await service.upsertDomainTld({
    tld: 'org',
    enabled: true,
    currency: 'USD',
    wholesaleCost: 8,
    salePrice: 14,
    registrationPrice: 14,
    renewalPrice: 16,
    transferPrice: 12,
    effectiveFrom: '2026-09-01'
  }, 'platform-admin');
  return service.quoteDomain({
    organizationId,
    domain: `${suffix}.example.org`,
    idempotencyKey: `quote-${suffix}`
  }, 'tenant-admin');
}

function orderInput(organizationId, quote, suffix = 'one') {
  return {
    organizationId,
    quoteId: quote.id,
    idempotencyKey: `order-${suffix}`,
    plan: 'premium',
    billingCycle: 'monthly',
    subscriptionAmount: 49,
    registrantConsent: true,
    registrant: {
      name: 'Example Institution',
      organization: 'Example Institution',
      email: 'admin@example.org',
      countryCode: 'SN'
    }
  };
}

test('provider configuration is disabled safely and credentials are only masked', async () => {
  const disabled = createDomainProvider({
    env: {
      DOMAIN_PROVIDER_MODE: 'openprovider',
      OPENPROVIDER_USERNAME: 'registrar-user'
    }
  });
  assert.equal(disabled.status().available, false);
  assert.equal(disabled.status().credentials.masked, '********');
  assert.doesNotMatch(JSON.stringify(disabled.status()), /registrar-user/);
  await assert.rejects(disabled.quote('school.example.org'), /requires OPENPROVIDER_USERNAME/);
  const manual = createDomainProvider({ env: { DOMAIN_PROVIDER_MODE: 'manual' } });
  assert.equal(manual.status().provider, 'manual');
  assert.equal(manual.status().available, false);

  const configured = new OpenproviderDomainProvider({
    env: {
      OPENPROVIDER_USERNAME: 'registrar-user',
      OPENPROVIDER_PASSWORD: 'registrar-secret',
      OPENPROVIDER_OWNER_HANDLE: 'owner',
      OPENPROVIDER_ADMIN_HANDLE: 'admin',
      OPENPROVIDER_BILLING_HANDLE: 'billing',
      OPENPROVIDER_TECH_HANDLE: 'tech'
    },
    fetchImpl: async () => {
      throw new Error('network should not be called for status');
    }
  });
  const status = configured.status();
  assert.equal(status.available, true);
  assert.equal(status.credentials.masked, '********');
  assert.doesNotMatch(JSON.stringify(status), /registrar-(user|secret)/);
});

test('catalog prices, separate line items, idempotency, lifecycle and transfer rights are enforced', async () => {
  const provider = new FakeDomainProvider();
  const service = createPersistentEducationPlatformService({
    databaseUrl: 'sqlite::memory:',
    domainProvider: provider
  });
  try {
    const tenant = await createTenant(service, 'Lifecycle');
    const quote = await seedQuote(service, tenant.organization.id, 'lifecycle');
    assert.equal(quote.registrationPrice, 14);
    assert.equal(quote.renewalPrice, 16);
    assert.equal((await seedQuote(service, tenant.organization.id, 'lifecycle')).id, quote.id);

    const input = orderInput(tenant.organization.id, quote, 'lifecycle');
    const order = await service.createDomainOrder(input, tenant.account.id);
    assert.equal((await service.createDomainOrder(input, tenant.account.id)).id, order.id);
    assert.deepEqual(order.lineItems.map((line) => line.type), ['saas_subscription', 'domain_registration']);
    assert.equal(order.lineItems[1].billingCycle, 'annual');
    assert.equal(order.paymentState, 'pending');
    assert.equal(order.lifecycleState, 'pending_payment');
    await assert.rejects(service.submitDomainRegistration(order.id, 'platform-admin'), /before authenticated payment/);
    assert.equal(provider.calls.filter((call) => call.action === 'register').length, 0);

    await assert.rejects(
      Promise.resolve().then(() => service.markDomainOrderPaid(order.id, { confirmed: true }, 'platform-admin')),
      /reason/
    );
    await service.markDomainOrderPaid(order.id, {
      confirmed: true,
      reason: 'Authenticated manual settlement reference PAY-100'
    }, 'platform-admin');
    assert.equal(order.lifecycleState, 'pending_registration');
    await service.submitDomainRegistration(order.id, 'platform-admin');
    assert.equal(order.lifecycleState, 'pending_dns');
    assert.match(order.providerReference, /^fake-registration-/);
    await service.updateDomainProvisioning(order.id, { dnsState: 'verified', tlsState: 'active' }, 'platform-admin');
    assert.equal(order.lifecycleState, 'active');

    assert.throws(
      () => service.requestDomainTransfer(order.id, { confirmation: 'wrong.example.org', reason: 'Move' }, tenant.account.id),
      /exact domain/
    );
    await service.requestDomainTransfer(order.id, {
      confirmation: order.domain,
      reason: 'Registrant selected another registrar',
      authCode: 'private-transfer-code'
    }, tenant.account.id);
    assert.equal(order.lifecycleState, 'transfer_pending');
    assert.equal(order.autoRenew, false);
    assert.equal(service.listDomainOrders(tenant.organization.id).items[0].transferAuthCodeHash, undefined);
    assert.doesNotMatch(JSON.stringify(service.listDomainOrders(tenant.organization.id)), /private-transfer-code/);

    const audits = service.connection.all(
      "SELECT action FROM audit_trail WHERE entity_id = ? ORDER BY created_at",
      [order.id]
    ).map((entry) => entry.action);
    assert.ok(audits.includes('domain.payment.confirm'));
    assert.ok(audits.includes('domain.registration.submitted'));
    assert.ok(audits.includes('domain.transfer.request'));
    await service.requestDomainRenewal(order.id, { idempotencyKey: 'renew-1' }, tenant.account.id);
    assert.equal(order.renewalPaymentState, 'pending');
    await service.cancelDomainManagement(order.id, {
      confirmation: order.domain,
      reason: 'SaaS cancellation while preserving transfer'
    }, tenant.account.id);
    assert.equal(order.transferRightsPreserved, true);
    assert.ok(order.dataGraceUntil);
    await service.reconcileDomainOrder(order.id, {
      refundState: 'pending',
      reason: 'Refund requested from payment provider'
    }, 'platform-admin');
    assert.equal(order.refundState, 'pending');
  } finally {
    await service.close();
  }
});

test('renewal notices use 60, 30, 15 and 7 day milestones without duplication', async () => {
  const service = createPersistentEducationPlatformService({
    databaseUrl: 'sqlite::memory:',
    domainProvider: new FakeDomainProvider()
  });
  try {
    const tenant = await createTenant(service, 'Notice');
    const quote = await seedQuote(service, tenant.organization.id, 'notice');
    const order = await service.createDomainOrder(orderInput(tenant.organization.id, quote, 'notice'), tenant.account.id);
    await service.markDomainOrderPaid(order.id, { confirmed: true, reason: 'Test payment' }, 'platform-admin');
    await service.submitDomainRegistration(order.id, 'platform-admin');
    await service.updateDomainProvisioning(order.id, { dnsState: 'verified', tlsState: 'active' }, 'platform-admin');
    order.expiryDate = '2027-09-12';
    assert.equal(service.collectDomainRenewalNotices(new Date('2027-07-20T00:00:00Z')).at(0).days, 60);
    assert.equal(service.collectDomainRenewalNotices(new Date('2027-07-20T00:00:00Z')).length, 0);
    assert.equal(service.collectDomainRenewalNotices(new Date('2027-08-20T00:00:00Z')).at(0).days, 30);
    assert.equal(service.collectDomainRenewalNotices(new Date('2027-09-01T00:00:00Z')).at(0).days, 15);
    assert.equal(service.collectDomainRenewalNotices(new Date('2027-09-06T00:00:00Z')).at(0).days, 7);
  } finally {
    await service.close();
  }
});

test('tenant and platform routes enforce role separation, isolation, safe summaries and legacy redirects', async () => {
  const service = createPersistentEducationPlatformService({
    databaseUrl: 'sqlite::memory:',
    domainProvider: new FakeDomainProvider()
  });
  try {
    const first = await createTenant(service, 'First');
    const second = await createTenant(service, 'Second');
    const platform = await createTenant(service, 'Platform');
    const platformToken = await addRole(service, platform, 'platform-admin');
    const quote = await seedQuote(service, first.organization.id, 'isolated');
    await service.createDomainOrder(orderInput(first.organization.id, quote, 'isolated'), first.account.id);
    const app = createApp({ foundation: service });
    const crossTenant = await app(new Request(
      `https://eduplateforme.test/domain-subscription/orders?organizationId=${first.organization.id}`,
      { headers: { authorization: `Bearer ${second.token}` } }
    ));
    assert.equal(crossTenant.status, 403);
    const providerStatus = await app(new Request(
      'https://eduplateforme.test/platform/domain-reseller/provider',
      { headers: { authorization: `Bearer ${first.token}` } }
    ));
    assert.equal(providerStatus.status, 403);

    const offersResponse = await app(new Request(
      `https://eduplateforme.test/domain-subscription/offers?organizationId=${first.organization.id}`,
      { headers: { authorization: `Bearer ${first.token}` } }
    ));
    assert.equal(offersResponse.status, 200);
    const offers = await offersResponse.json();
    assert.equal(offers.items[0].registrationPrice, 14);
    assert.equal(Object.hasOwn(offers.items[0], 'wholesaleCost'), false);
    assert.equal(Object.hasOwn(offers.items[0], 'margin'), false);

    const tenantDestination = await app(new Request(
      'https://eduplateforme.test/domain-reseller/destination',
      { headers: { authorization: `Bearer ${first.token}` } }
    ));
    assert.deepEqual(await tenantDestination.json(), { path: '/domain-subscription' });
    const platformDestination = await app(new Request(
      'https://eduplateforme.test/domain-reseller/destination',
      { headers: { authorization: `Bearer ${platformToken}` } }
    ));
    assert.deepEqual(await platformDestination.json(), { path: '/platform/domain-reseller' });

    const platformTenantSurface = await app(new Request(
      `https://eduplateforme.test/domain-subscription/offers?organizationId=${platform.organization.id}`,
      { headers: { authorization: `Bearer ${platformToken}` } }
    ));
    assert.equal(platformTenantSurface.status, 403);
    const platformProvider = await app(new Request(
      'https://eduplateforme.test/platform/domain-reseller/provider',
      { headers: { authorization: `Bearer ${platformToken}` } }
    ));
    assert.equal(platformProvider.status, 200);
    const globalOrdersResponse = await app(new Request(
      'https://eduplateforme.test/platform/domain-reseller/orders',
      { headers: { authorization: `Bearer ${platformToken}` } }
    ));
    assert.equal(globalOrdersResponse.status, 200);
    const globalOrders = await globalOrdersResponse.json();
    assert.equal(globalOrders.items.length, 1);
    assert.equal(Object.hasOwn(globalOrders.items[0], 'registrant'), false);
    const incidentResponse = await app(new Request(
      'https://eduplateforme.test/platform/domain-reseller/incidents',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${platformToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ title: 'Registrar delay', severity: 'high' })
      }
    ));
    assert.equal(incidentResponse.status, 201);
    const tenantIncidentAccess = await app(new Request(
      'https://eduplateforme.test/platform/domain-reseller/incidents',
      { headers: { authorization: `Bearer ${first.token}` } }
    ));
    assert.equal(tenantIncidentAccess.status, 403);
    const auditResponse = await app(new Request(
      'https://eduplateforme.test/platform/domain-reseller/audit',
      { headers: { authorization: `Bearer ${platformToken}` } }
    ));
    assert.equal(auditResponse.status, 200);

    const viewer = await createTenant(service, 'Viewer');
    for (const assignment of service.roleAssignments.values()) {
      if (assignment.personId === viewer.person.id && assignment.organizationId === viewer.organization.id) {
        assignment.status = 'archived';
      }
    }
    const viewerToken = await addRole(service, viewer, 'teacher');
    const viewerDestination = await app(new Request(
      'https://eduplateforme.test/domain-reseller/destination',
      { headers: { authorization: `Bearer ${viewerToken}` } }
    ));
    assert.deepEqual(await viewerDestination.json(), { path: '/dashboard' });
  } finally {
    await service.close();
  }
});

test('domain reseller catalog and unpaid orders persist in PostgreSQL', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const databaseUrl = 'postgresql://memory/domain-reseller';
  const firstConnection = await createPostgresConnection(databaseUrl, { Pool });
  const first = await initializePersistentEducationPlatformService({
    connection: firstConnection,
    domainProvider: new FakeDomainProvider()
  });
  const organization = await first.createOrganization({
    legalName: 'Persistent Domain School',
    displayName: 'Persistent Domain School',
    countryCode: 'SN'
  }, 'bootstrap');
  const quote = await seedQuote(first, organization.id, 'persistent');
  const order = await first.createDomainOrder(orderInput(organization.id, quote, 'persistent'), 'bootstrap');
  await first.close();

  const secondConnection = await createPostgresConnection(databaseUrl, { Pool });
  const second = await initializePersistentEducationPlatformService({
    connection: secondConnection,
    domainProvider: new FakeDomainProvider()
  });
  try {
    assert.equal(second.listDomainTldCatalog().items[0].margin, 6);
    assert.equal(second.listDomainOrders(organization.id).items[0].id, order.id);
    assert.equal(second.listDomainOrders(organization.id).items[0].paymentState, 'pending');
  } finally {
    await second.close();
  }
});

test('domain UI separates platform and tenant controls with localized accessible navigation', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../public/app.js', import.meta.url), 'utf8'));
  const styles = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../public/styles.css', import.meta.url), 'utf8'));
  const helpSource = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../src/http/routes/operations.js', import.meta.url), 'utf8'));
  assert.match(source, /Domaine et abonnement/);
  assert.match(source, /Revente de domaines/);
  assert.match(source, /L’institution est le titulaire/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /domain-quote-form/);
  assert.match(source, /dir = state\.locale === 'ar' \? 'rtl'/);
  assert.match(source, /domainSubscription: \['Domain and subscription'/);
  assert.match(source, /domainSubscription: \['Dominio y suscripción'/);
  assert.match(source, /domainSubscription: \['Domínio e subscrição'/);
  assert.match(source, /domainSubscription: \['النطاق والاشتراك'/);
  const tenantSurface = source.slice(
    source.indexOf("if (module.id === 'domainSubscription'"),
    source.indexOf("if (module.id === 'platformDomainReseller'")
  );
  assert.doesNotMatch(tenantSurface, /wholesaleCost|margin|domain-reseller\/provider|platform\/domain-reseller/);
  assert.match(tenantSurface, /domain-subscription\/offers/);
  const platformSurface = source.slice(
    source.indexOf("if (module.id === 'platformDomainReseller'"),
    source.indexOf("if (module.id === 'attendance'")
  );
  assert.match(platformSurface, /wholesaleCost/);
  assert.match(platformSurface, /domain-reseller\/provider/);
  assert.match(platformSurface, /domain-reseller\/incidents/);
  assert.match(platformSurface, /domain-reseller\/audit/);
  assert.match(source, /path === '\/domain-reseller'/);
  assert.match(source, /apiRequest\('\/domain-reseller\/destination'\)/);
  assert.match(source, /platformNavigation = new Set\(\['platformDomainReseller', 'operations', 'audit', 'support'\]\)/);
  assert.match(helpSource, /id: 'domainSubscription'/);
  assert.match(helpSource, /id: 'platformDomainReseller'/);
  assert.match(styles, /button, input, select \{ min-height: 44px; \}/);
});
