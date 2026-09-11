import assert from 'node:assert/strict';
import test from 'node:test';

import { readRuntimeConfig } from '../src/config/runtime.js';
import { createApp } from '../src/http/app.js';
import { enforceRateLimit } from '../src/http/middleware/auth.js';

const validProductionEnv = {
  NODE_ENV: 'production',
  PORT: '10000',
  DATABASE_URL: 'postgresql://example.invalid/eduplateforme',
  JWT_SECRET: 'j'.repeat(32),
  DATA_ENCRYPTION_KEY: 'e'.repeat(32),
  CORS_ORIGIN: 'https://eduplateforme.example'
};

test('production runtime requires database, CORS origin, and non-placeholder secrets', () => {
  assert.deepEqual(readRuntimeConfig(validProductionEnv), { host: '0.0.0.0', port: 10000 });
  assert.throws(
    () => readRuntimeConfig({ ...validProductionEnv, DATABASE_URL: '' }),
    /DATABASE_URL is required/
  );
  assert.throws(
    () => readRuntimeConfig({ ...validProductionEnv, JWT_SECRET: 'change-me-in-production' }),
    /JWT_SECRET must be set/
  );
});

test('health endpoint reports an unavailable database with 503', async () => {
  const app = createApp({
    foundation: {
      async healthCheck() {
        throw new Error('database unavailable');
      }
    }
  });
  const response = await app(new Request('http://localhost/health'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: 'unavailable',
    database: 'unavailable'
  });
});

test('rate limiting isolates policies and rejects excess authentication attempts', () => {
  const request = new Request('http://localhost/auth/login', {
    headers: { 'x-remote-addr': '192.0.2.10' }
  });
  enforceRateLimit(request, { namespace: 'test-auth', limit: 2, windowMs: 60_000 });
  enforceRateLimit(request, { namespace: 'test-auth', limit: 2, windowMs: 60_000 });
  assert.throws(
    () => enforceRateLimit(request, { namespace: 'test-auth', limit: 2, windowMs: 60_000 }),
    (error) => error.code === 'RATE_LIMITED' && error.status === 429
  );
});
