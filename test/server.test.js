import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from '../src/server.js';

const applicationRoutes = [
  ['/', 'Accueil'],
  ['/login', 'Connexion'],
  ['/register', 'Créer un compte'],
  ['/onboarding', 'Créer votre école'],
  ['/dashboard', 'Dashboard'],
  ['/organizations', 'Organizations'],
  ['/people', 'People & Identity'],
  ['/academics', 'Academics & Enrollments'],
  ['/assignments', 'Devoirs et soumissions'],
  ['/grading', 'Notes'],
  ['/attendance', 'Présences'],
  ['/scheduling', 'Emplois du temps'],
  ['/finance', 'Finances'],
  ['/notifications', 'Notifications'],
  ['/virtual-schools', 'Académie virtuelle'],
  ['/certificates', 'Certificats'],
  ['/i18n', 'Localisation'],
  ['/security/parental-consents', 'Consentements parentaux'],
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
      assert.match(html, new RegExp(`<title>Eduplateforme · ${title.replaceAll('&', '&amp;')}</title>`));
      assert.match(html, /id="app"/);
      assert.match(html, /Chargement de votre espace/);
    }
  });
});

test('serves the static shell assets', async () => {
  await withServer(async (baseUrl) => {
    const assetChecks = [
      ['/styles.css', /text\/css/, /--primary/],
      ['/app.js', /text\/javascript/, /onboarding/],
      ['/manifest.webmanifest', /application\/manifest\+json/, /"start_url": "\/"/],
    ];

    for (const [route, contentType, snippet] of assetChecks) {
      const response = await fetch(`${baseUrl}${route}`, {
        headers: { origin: baseUrl },
      });
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', contentType);
      assert.match(body, snippet);
      assert.equal(response.headers.get('access-control-allow-origin'), baseUrl);
    }

    const forbiddenResponse = await fetch(`${baseUrl}/app.js`, {
      headers: { origin: 'https://malicious.example' },
    });
    assert.equal(forbiddenResponse.status, 403);
  });
});

test('frontend exposes real forms, status handling, and operational actions', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/app.js`);
    const javascript = await response.text();
    for (const endpoint of [
      '/assignments/submissions', '/grading/systems', '/attendance/records',
      '/scheduling/entries', '/finance/payments', '/notifications/sent',
      '/virtual-schools/trainings', '/certificates', '/i18n/profiles',
      '/security/parental-consents'
    ]) {
      assert.match(javascript, new RegExp(endpoint.replaceAll('/', '\\/')));
    }
    assert.match(javascript, /Chargement des données/);
    assert.match(javascript, /Aucune donnée/);
    assert.match(javascript, /notification\(error\.message, 'error'\)/);
    assert.match(javascript, /inline-action-form/);
    assert.ok(
      javascript.indexOf("document.querySelectorAll('.inline-action-form')") <
        javascript.indexOf("document.querySelectorAll('[data-action=\"edit\"]')")
    );
    assert.ok(
      javascript.indexOf("document.querySelectorAll('[data-action=\"history\"]')") >
        javascript.indexOf("document.querySelectorAll('[data-action=\"edit\"]')")
    );
  });
});

test('returns not found for unknown routes', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    assert.equal(response.status, 404);
  });
});
