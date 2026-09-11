import assert from 'node:assert/strict';
import test from 'node:test';
import { newDb } from 'pg-mem';

import { createPostgresConnection } from '../../src/db/connection.js';
import { createHttpServer } from '../../src/http/server.js';
import {
  createPersistentEducationPlatformService,
  initializePersistentEducationPlatformService
} from '../../src/services/persistent-education-platform-service.js';

async function start(service) {
  const server = createHttpServer({ foundation: service });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))
  };
}

async function request(baseUrl, path, { token, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

async function registerTenant(baseUrl, suffix) {
  const registration = await request(baseUrl, '/auth/register', {
    method: 'POST',
    expected: 201,
    body: {
      givenName: `Admin${suffix}`,
      familyName: 'Test',
      username: `mobility-${suffix.toLowerCase()}`,
      email: `mobility-${suffix.toLowerCase()}@example.edu`,
      password: 'correct-horse-battery'
    }
  });
  const onboarding = await request(baseUrl, '/auth/onboarding', {
    token: registration.accessToken,
    method: 'POST',
    body: {
      legalName: `Institution ${suffix}`,
      displayName: suffix,
      internalReference: `MOB-${suffix}`,
      countryCode: 'SN',
      organizationType: 'school'
    }
  });
  return { token: onboarding.accessToken, organizationId: onboarding.user.organizationId };
}

test('documents, credentials, public verification, sharing, consent and transfer form a retained audited flow', async () => {
  const service = createPersistentEducationPlatformService({ databaseUrl: 'sqlite::memory:' });
  const server = await start(service);
  try {
    const source = await registerTenant(server.baseUrl, 'Source');
    const destination = await registerTenant(server.baseUrl, 'Destination');
    const holder = await request(server.baseUrl, '/people', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        primaryOrganizationId: source.organizationId,
        givenName: 'Awa',
        familyName: 'Diallo'
      }
    });
    const learner = await request(server.baseUrl, '/academics/learners', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: { organizationId: source.organizationId, personId: holder.id, learnerNumber: 'SRC-001' }
    });
    const sourceYear = await request(server.baseUrl, '/academics/years', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        code: '2026',
        name: '2026-2027',
        startsOn: '2026-09-01',
        endsOn: '2027-06-30'
      }
    });
    const sourceProgram = await request(server.baseUrl, '/academics/programs', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        academicYearId: sourceYear.id,
        code: 'SCI',
        name: 'Sciences'
      }
    });
    const template = await request(server.baseUrl, '/document-templates', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        name: 'Diplôme officiel',
        documentType: 'diploma',
        schema: { required: ['holder', 'qualification'] },
        requiredSignerFunctions: ['rector']
      }
    });
    const document = await request(server.baseUrl, '/documents', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        personId: holder.id,
        type: 'diploma',
        title: 'Diplôme de sciences',
        storageReference: 'vault://diplomas/awa',
        fileContent: 'immutable-pdf-content',
        metadata: { studentEmail: 'awa@example.edu', mention: 'bien' },
        accessLevel: 'restricted',
        expiresAt: '2035-01-01T00:00:00.000Z'
      }
    });
    assert.match(document.fileHash, /^[a-f0-9]{64}$/);
    const pseudonymized = await request(server.baseUrl, `/documents/${document.id}/pseudonymize`, {
      token: source.token,
      method: 'POST',
      body: { metadataFields: ['studentEmail'], reason: 'Durée de conservation atteinte pour le contact' }
    });
    assert.equal(pseudonymized.metadata.studentEmail, '[pseudonymized]');

    const credential = await request(server.baseUrl, '/credentials', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        personId: holder.id,
        documentId: document.id,
        templateId: template.id,
        credentialType: 'diploma',
        qualification: 'Licence en sciences',
        programId: sourceProgram.id,
        signatories: [{
          name: 'Dr Rector',
          function: 'rector',
          signatureType: 'digital',
          evidenceReference: 'vault://signatures/rector'
        }],
        sealReference: 'vault://seals/source'
      }
    });
    assert.equal(credential.templateSnapshot.versionNumber, 1);
    assert.match(credential.publicReference, /^[A-Za-z0-9_-]{20,}$/);
    assert.match(credential.verificationToken, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal('fileContent' in credential, false);

    await request(server.baseUrl, `/document-templates/${template.id}`, {
      token: source.token,
      method: 'PUT',
      body: { schema: { required: ['changed'] }, versionNumber: 2 }
    });
    const unchangedCredential = await request(server.baseUrl, `/credentials/${credential.id}`, {
      token: source.token
    });
    assert.deepEqual(unchangedCredential.templateSnapshot.schema.required, ['holder', 'qualification']);

    const publicCredential = await request(
      server.baseUrl,
      `/public/credentials/verify/${credential.publicReference}`
    );
    assert.deepEqual(Object.keys(publicCredential).sort(), [
      'credentialNumber',
      'credentialType',
      'expiresAt',
      'holder',
      'integrity',
      'issuedAt',
      'issuer',
      'qualification',
      'reference',
      'replacementReference',
      'status',
      'validFrom'
    ]);
    assert.equal(publicCredential.integrity, true);
    assert.equal('documentId' in publicCredential, false);
    assert.equal('organizationId' in publicCredential, false);
    assert.equal('templateSnapshot' in publicCredential, false);
    await request(server.baseUrl, '/credentials/revisions', {
      token: source.token,
      method: 'POST',
      expected: 400,
      body: {
        previousCredentialId: credential.id,
        organizationId: destination.organizationId,
        documentId: document.id,
        reason: 'Tentative inter-tenant'
      }
    });

    const replacementDocument = await request(server.baseUrl, '/documents/versions', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        previousDocumentId: document.id,
        storageReference: 'vault://diplomas/awa-v2',
        fileContent: 'corrected-pdf-content'
      }
    });
    const replacement = await request(server.baseUrl, '/credentials/revisions', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        previousCredentialId: credential.id,
        documentId: replacementDocument.id,
        reason: 'Correction du nom du programme'
      }
    });
    assert.equal((await request(server.baseUrl, `/credentials/${credential.id}`, { token: source.token })).status, 'replaced');
    assert.equal(
      (await request(server.baseUrl, `/public/credentials/verify/${credential.publicReference}`)).replacementReference,
      replacement.publicReference
    );
    await request(server.baseUrl, `/credentials/${replacement.id}/transition`, {
      token: source.token,
      method: 'POST',
      body: { status: 'revoked', reason: 'Fraude documentaire confirmée', authority: 'Registrar' }
    });
    assert.equal(
      (await request(server.baseUrl, `/public/credentials/verify/${replacement.publicReference}`)).status,
      'revoked'
    );

    const consent = await request(server.baseUrl, '/security/consents', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        subjectPersonId: holder.id,
        authorityPersonId: holder.id,
        subjectCapacity: 'adult',
        purpose: 'Transfert académique',
        dataScope: ['identity', 'enrollment', 'title', 'fileHash'],
        recipientOrganizationId: destination.organizationId,
        legalBasis: 'consent',
        expiresAt: '2030-01-01T00:00:00.000Z'
      }
    });
    const share = await request(server.baseUrl, '/document-shares', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        documentId: replacementDocument.id,
        recipient: 'registrar@destination.example',
        purpose: 'Admission',
        dataScope: ['title', 'fileHash'],
        consentId: consent.id,
        expiresAt: '2030-01-01T00:00:00.000Z'
      }
    });
    const shared = await request(server.baseUrl, `/public/document-shares/${share.accessToken}`);
    assert.deepEqual(Object.keys(shared).sort(), ['fileHash', 'title']);
    await request(server.baseUrl, `/document-shares/${share.id}/revoke`, {
      token: source.token,
      method: 'POST',
      body: { status: 'refused', reason: 'Destinataire non confirmé' }
    });
    await request(server.baseUrl, `/public/document-shares/${share.accessToken}`, { expected: 400 });
    const expiredShare = await request(server.baseUrl, '/document-shares', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        documentId: replacementDocument.id,
        recipient: 'expired@example.edu',
        purpose: 'Test expiration',
        dataScope: ['title'],
        expiresAt: new Date(Date.now() + 25).toISOString()
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    await request(server.baseUrl, `/public/document-shares/${expiredShare.accessToken}`, { expected: 400 });

    const destinationYear = await request(server.baseUrl, '/academics/years', {
      token: destination.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: destination.organizationId,
        code: '2026',
        name: '2026-2027',
        startsOn: '2026-09-01',
        endsOn: '2027-06-30'
      }
    });
    const destinationProgram = await request(server.baseUrl, '/academics/programs', {
      token: destination.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: destination.organizationId,
        academicYearId: destinationYear.id,
        code: 'SCI',
        name: 'Sciences'
      }
    });
    const destinationClass = await request(server.baseUrl, '/academics/classes', {
      token: destination.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: destination.organizationId,
        academicYearId: destinationYear.id,
        programId: destinationProgram.id,
        code: 'SCI-A',
        name: 'Sciences A'
      }
    });
    const collaboration = await request(server.baseUrl, '/collaboration/requests', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        destinationOrganizationId: destination.organizationId,
        requestType: 'transfer',
        purpose: 'Admission',
        dataScope: ['identity', 'enrollment'],
        expiresAt: '2030-01-01T00:00:00.000Z'
      }
    });
    await request(server.baseUrl, `/collaboration/requests/${collaboration.id}/decision`, {
      token: destination.token,
      method: 'POST',
      body: {
        status: 'partial',
        acceptedDataScope: ['identity'],
        reason: 'Dossier académique à compléter'
      }
    });
    const transfer = await request(server.baseUrl, '/transfers', {
      token: source.token,
      method: 'POST',
      expected: 201,
      body: {
        organizationId: source.organizationId,
        destinationOrganizationId: destination.organizationId,
        learnerId: learner.id,
        requestedData: ['identity', 'enrollment'],
        authorizationBasis: 'consent',
        consentId: consent.id,
        securePayloadReference: 'vault://transfers/source-destination',
        destinationClassId: destinationClass.id,
        destinationAcademicYearId: destinationYear.id
      }
    });
    for (const status of ['requested', 'validated', 'sent']) {
      await request(server.baseUrl, `/transfers/${transfer.id}/transition`, {
        token: source.token,
        method: 'POST',
        body: { status, reason: `Passage ${status}` }
      });
    }
    const acknowledged = await request(server.baseUrl, `/transfers/${transfer.id}/transition`, {
      token: destination.token,
      method: 'POST',
      body: {
        status: 'acknowledged',
        reason: 'Dossier reçu et contrôlé',
        createEnrollment: true,
        destinationLearnerNumber: 'DST-001',
        destinationClassId: destinationClass.id,
        destinationAcademicYearId: destinationYear.id,
        enrollmentReference: 'TRANSFER-001'
      }
    });
    assert.ok(acknowledged.destinationEnrollmentId);
    assert.equal(service.learners.get(learner.id).organizationId, source.organizationId);
    await request(server.baseUrl, `/transfers/${transfer.id}`, { expected: 401 });

    await request(server.baseUrl, `/documents/${replacementDocument.id}`, {
      token: source.token,
      method: 'DELETE'
    });
    const retained = await request(
      server.baseUrl,
      `/documents?organizationId=${source.organizationId}&includeArchived=true`,
      { token: source.token }
    );
    assert.ok(retained.items.some((item) => item.id === replacementDocument.id && item.status === 'archived'));

    const audit = await request(
      server.baseUrl,
      `/audit/trail?organizationId=${source.organizationId}&limit=200`,
      { token: source.token }
    );
    const revocation = audit.items.find((entry) => entry.action === 'credential.transition.revoked');
    assert.equal(revocation.reason, 'Fraude documentaire confirmée');
    assert.equal(revocation.before.status, 'issued');
    assert.equal(revocation.after.status, 'revoked');
    assert.ok(audit.items.some((entry) => entry.action === 'credential.public-verify'));
    assert.ok(audit.items.some((entry) => entry.action === 'document-share.access'));
  } finally {
    await server.close();
    await service.close();
  }
});

test('document mobility collections persist through PostgreSQL asynchronous repositories', async () => {
  const memoryDatabase = newDb({ noAstCoverageCheck: true });
  const { Pool } = memoryDatabase.adapters.createPg();
  const databaseUrl = 'postgresql://memory/document-mobility';
  const firstConnection = await createPostgresConnection(databaseUrl, { Pool });
  const first = await initializePersistentEducationPlatformService({ connection: firstConnection });

  const issuer = await first.createOrganization({
    legalName: 'Issuer',
    displayName: 'Issuer',
    internalReference: 'PG-ISSUER',
    countryCode: 'SN'
  }, 'bootstrap');
  const recipient = await first.createOrganization({
    legalName: 'Recipient',
    displayName: 'Recipient',
    internalReference: 'PG-RECIPIENT',
    countryCode: 'SN'
  }, 'bootstrap');
  const holder = await first.registerPerson({
    givenName: 'Postgres',
    familyName: 'Holder',
    primaryOrganizationId: issuer.id
  }, 'bootstrap');
  const document = await first.registerDocument({
    organizationId: issuer.id,
    personId: holder.id,
    type: 'attestation',
    title: 'Attestation PostgreSQL',
    storageReference: 'vault://postgres/document'
  }, 'bootstrap');
  const template = await first.createDocumentTemplate({
    organizationId: issuer.id,
    name: 'Attestation',
    documentType: 'attestation',
    schema: { locale: 'fr' }
  }, 'bootstrap');
  const credential = await first.issueCredential({
    organizationId: issuer.id,
    personId: holder.id,
    documentId: document.id,
    templateId: template.id,
    credentialType: 'attestation',
    qualification: 'Participation'
  }, 'bootstrap');
  const consent = await first.recordConsent({
    organizationId: issuer.id,
    subjectPersonId: holder.id,
    authorityPersonId: holder.id,
    subjectCapacity: 'adult',
    purpose: 'Vérification',
    dataScope: ['title'],
    recipientOrganizationId: recipient.id,
    legalBasis: 'consent',
    expiresAt: '2030-01-01T00:00:00.000Z'
  }, 'bootstrap');
  await first.createDocumentShare({
    organizationId: issuer.id,
    documentId: document.id,
    recipient: 'recipient@example.edu',
    purpose: 'Vérification',
    dataScope: ['title'],
    consentId: consent.id,
    expiresAt: '2030-01-01T00:00:00.000Z'
  }, 'bootstrap');
  await first.close();

  const secondConnection = await createPostgresConnection(databaseUrl, { Pool });
  const second = await initializePersistentEducationPlatformService({ connection: secondConnection });
  try {
    assert.equal(second.documents.get(document.id).fileHash, document.fileHash);
    assert.equal(second.credentials.get(credential.id).templateSnapshot.id, template.id);
    assert.equal(second.consents.get(consent.id).recipientOrganizationId, recipient.id);
    assert.equal(second.documentShares.size, 1);
    assert.equal((await second.verifyPublicCredential(credential.publicReference)).integrity, true);
  } finally {
    await second.close();
  }
});
