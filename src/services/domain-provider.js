import { ApiError } from '../shared/errors.js';
import { normalizeCustomDomain } from './custom-domain-service.js';

const DEFAULT_TIMEOUT_MS = 10_000;

function splitDomain(domain) {
  const labels = normalizeCustomDomain(domain).split('.');
  return {
    name: labels.slice(0, -1).join('.'),
    extension: labels.at(-1)
  };
}

function configuredCredentialStatus(env) {
  const username = Boolean(env.OPENPROVIDER_USERNAME);
  const password = Boolean(env.OPENPROVIDER_PASSWORD);
  return {
    username: username ? 'configured' : 'missing',
    password: password ? 'configured' : 'missing',
    masked: username || password ? '********' : null
  };
}

export class DisabledDomainProvider {
  constructor({ reason = 'Registrar integration is disabled.', env = process.env } = {}) {
    this.code = 'disabled';
    this.environment = 'disabled';
    this.reason = reason;
    this.credentials = configuredCredentialStatus(env);
  }

  status() {
    return {
      provider: this.code,
      environment: this.environment,
      available: false,
      credentials: this.credentials,
      balance: null,
      lastSyncAt: null,
      lastError: this.reason
    };
  }

  async quote() {
    throw new ApiError('DOMAIN_PROVIDER_UNAVAILABLE', this.reason, 503);
  }

  async register() {
    throw new ApiError('DOMAIN_PROVIDER_UNAVAILABLE', this.reason, 503);
  }

  async renew() {
    throw new ApiError('DOMAIN_PROVIDER_UNAVAILABLE', this.reason, 503);
  }

  async transfer() {
    throw new ApiError('DOMAIN_PROVIDER_UNAVAILABLE', this.reason, 503);
  }
}

export class ManualDomainProvider extends DisabledDomainProvider {
  constructor({ env = process.env } = {}) {
    super({
      env,
      reason: 'Manual registrar mode records lifecycle actions but cannot check availability or perform transactions.'
    });
    this.code = 'manual';
    this.environment = env.DOMAIN_PROVIDER_ENVIRONMENT ?? 'manual';
  }
}

export class FakeDomainProvider {
  constructor({
    available = true,
    wholesalePrice = 8,
    renewalPrice = 10,
    currency = 'USD',
    balance = 1_000
  } = {}) {
    this.code = 'fake';
    this.environment = 'test';
    this.available = available;
    this.wholesalePrice = wholesalePrice;
    this.renewalPrice = renewalPrice;
    this.currency = currency;
    this.balance = balance;
    this.calls = [];
  }

  status() {
    return {
      provider: this.code,
      environment: this.environment,
      available: true,
      credentials: { username: 'test-adapter', password: 'test-adapter', masked: '********' },
      balance: { amount: this.balance, currency: this.currency },
      lastSyncAt: null,
      lastError: null
    };
  }

  async quote(domain) {
    const normalized = normalizeCustomDomain(domain);
    this.calls.push({ action: 'quote', domain: normalized });
    return {
      domain: normalized,
      available: this.available,
      wholesalePrice: this.wholesalePrice,
      renewalPrice: this.renewalPrice,
      currency: this.currency,
      providerReference: `fake-quote-${normalized}`
    };
  }

  async register(input) {
    const domain = normalizeCustomDomain(input.domain);
    this.calls.push({ action: 'register', domain });
    return {
      providerReference: `fake-registration-${domain}`,
      registrationDate: '2026-09-12',
      expiryDate: '2027-09-12'
    };
  }

  async renew(input) {
    const domain = normalizeCustomDomain(input.domain);
    this.calls.push({ action: 'renew', domain });
    return {
      providerReference: `fake-renewal-${domain}`,
      expiryDate: '2028-09-12'
    };
  }

  async transfer(input) {
    const domain = normalizeCustomDomain(input.domain);
    this.calls.push({ action: 'transfer', domain });
    return { providerReference: `fake-transfer-${domain}`, state: 'transfer_pending' };
  }
}

export class OpenproviderDomainProvider {
  constructor({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
    this.code = 'openprovider';
    this.environment = env.OPENPROVIDER_ENVIRONMENT ?? 'production';
    this.baseUrl = (env.OPENPROVIDER_BASE_URL ?? 'https://api.openprovider.eu/v1').replace(/\/$/, '');
    this.username = env.OPENPROVIDER_USERNAME;
    this.password = env.OPENPROVIDER_PASSWORD;
    this.handles = {
      owner: env.OPENPROVIDER_OWNER_HANDLE,
      admin: env.OPENPROVIDER_ADMIN_HANDLE,
      billing: env.OPENPROVIDER_BILLING_HANDLE,
      tech: env.OPENPROVIDER_TECH_HANDLE
    };
    this.fetch = fetchImpl;
    this.timeoutMs = Number(env.OPENPROVIDER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.lastSyncAt = null;
    this.lastError = null;
    this.balance = null;
  }

  status() {
    return {
      provider: this.code,
      environment: this.environment,
      available: Boolean(this.username && this.password && Object.values(this.handles).every(Boolean)),
      credentials: configuredCredentialStatus({
        OPENPROVIDER_USERNAME: this.username,
        OPENPROVIDER_PASSWORD: this.password
      }),
      balance: this.balance,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError
    };
  }

  async request(path, { method = 'GET', body = null, token = null } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiError(
          'DOMAIN_PROVIDER_ERROR',
          `Registrar request failed with status ${response.status}.`,
          502
        );
      }
      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
      return payload?.data ?? payload;
    } catch (error) {
      const normalized = error?.name === 'AbortError'
        ? new ApiError('DOMAIN_PROVIDER_TIMEOUT', 'Registrar request timed out.', 504)
        : error;
      this.lastError = normalized.message;
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  async authenticate() {
    if (!this.username || !this.password || !Object.values(this.handles).every(Boolean)) {
      throw new ApiError(
        'DOMAIN_PROVIDER_UNAVAILABLE',
        'Openprovider is disabled until credentials and institution contact handles are configured.',
        503
      );
    }
    const payload = await this.request('/auth/login', {
      method: 'POST',
      body: { username: this.username, password: this.password }
    });
    if (!payload?.token) {
      throw new ApiError('DOMAIN_PROVIDER_ERROR', 'Registrar authentication returned no token.', 502);
    }
    return payload.token;
  }

  async quote(domain) {
    const normalized = normalizeCustomDomain(domain);
    const token = await this.authenticate();
    const payload = await this.request('/domains/check', {
      method: 'POST',
      token,
      body: { domains: [splitDomain(normalized)] }
    });
    const result = payload?.results?.[0] ?? payload?.domains?.[0] ?? payload?.[0] ?? payload;
    return {
      domain: normalized,
      available: result?.status === 'free' || result?.available === true,
      wholesalePrice: result?.price?.product?.price ?? result?.price ?? null,
      renewalPrice: result?.renewal_price ?? null,
      currency: result?.price?.product?.currency ?? result?.currency ?? null,
      providerReference: result?.id ?? null
    };
  }

  async register(input) {
    const token = await this.authenticate();
    return this.request('/domains', {
      method: 'POST',
      token,
      body: {
        domain: splitDomain(input.domain),
        period: input.period ?? 1,
        owner_handle: this.handles.owner,
        admin_handle: this.handles.admin,
        billing_handle: this.handles.billing,
        tech_handle: this.handles.tech,
        autorenew: 'off'
      }
    });
  }

  async renew(input) {
    const token = await this.authenticate();
    return this.request('/domains/renew', { method: 'POST', token, body: input });
  }

  async transfer(input) {
    const token = await this.authenticate();
    return this.request('/domains/transfer', { method: 'POST', token, body: input });
  }
}

export function createDomainProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const mode = String(env.DOMAIN_PROVIDER_MODE ?? 'disabled').toLowerCase();
  if (mode === 'openprovider') {
    const required = [
      'OPENPROVIDER_USERNAME',
      'OPENPROVIDER_PASSWORD',
      'OPENPROVIDER_OWNER_HANDLE',
      'OPENPROVIDER_ADMIN_HANDLE',
      'OPENPROVIDER_BILLING_HANDLE',
      'OPENPROVIDER_TECH_HANDLE'
    ];
    if (required.some((key) => !env[key])) {
      return new DisabledDomainProvider({
        env,
        reason: `Openprovider mode requires ${required.join(', ')}.`
      });
    }
    return new OpenproviderDomainProvider({ env, fetchImpl });
  }
  if (mode === 'manual') return new ManualDomainProvider({ env });
  return new DisabledDomainProvider({
    env,
    reason: 'Registrar integration is disabled by DOMAIN_PROVIDER_MODE.'
  });
}
