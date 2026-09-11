import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from '../src/server.js';

const applicationRoutes = [
  ['/', 'Dashboard'],
  ['/dashboard', 'Dashboard'],
  ['/organizations', 'Organizations'],
  ['/people', 'People & Identity'],
  ['/academics', 'Academics & Enrollments'],
  ['/documents', 'Documents & Credentials'],
  ['/audit', 'Audit & Governance'],
];

async function withServer(run) {
  const server = createServer();

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test('serves each shell route with responsive foundation content', async () => {
  await withServer(async (baseUrl) => {
    for (const [route, title] of applicationRoutes) {
      const response = await fetch(`${baseUrl}${route}`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      assert.match(html, new RegExp(`<title>Eduplateforme · ${title}</title>`));
      assert.match(html, /Responsive shell/);
      assert.match(html, /People &amp; Identity|People & Identity/);
      assert.match(html, /Documents &amp; Credentials|Documents & Credentials/);
    }
  });
});

test('serves the static shell assets', async () => {
  await withServer(async (baseUrl) => {
    const assetChecks = [
      ['/styles.css', /text\/css/, /--primary/],
      ['/app.js', /text\/javascript/, /setNavigationState/],
      ['/manifest.webmanifest', /application\/manifest\+json/, /"start_url": "\/dashboard"/],
    ];

    for (const [route, contentType, snippet] of assetChecks) {
      const response = await fetch(`${baseUrl}${route}`);
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', contentType);
      assert.match(body, snippet);
    }
  });
});

test('returns not found for unknown routes', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    assert.equal(response.status, 404);
  });
});

test('serves foundation api metadata alongside the shell', async () => {
  await withServer(async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { status: 'ok' });

    const metaResponse = await fetch(`${baseUrl}/meta/invariants`);
    const meta = await metaResponse.json();

    assert.equal(metaResponse.status, 200);
    assert.equal(meta.scope, 'full-specification-foundation');
    assert.ok(Array.isArray(meta.invariants));
    assert.match(meta.invariants.join(' '), /learner_id != enrollment_id/);
  });
});

test('forwards non-shell requests to the API application', async () => {
  await withServer(async (baseUrl) => {
    const createOrganizationResponse = await fetch(`${baseUrl}/organizations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'account-admin'
      },
      body: JSON.stringify({
        legalName: 'Lycée Horizon',
        displayName: 'Horizon',
        internalReference: 'ORG-001',
        countryCode: 'SN'
      })
    });

    assert.equal(createOrganizationResponse.status, 201);
    const organization = await createOrganizationResponse.json();
    assert.equal(organization.displayName, 'Horizon');
    assert.equal(organization.internalReference, 'ORG-001');
  });
});
