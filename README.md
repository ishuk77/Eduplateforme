# Eduplateforme

Eduplateforme is an international education management SaaS foundation designed for **multi-tenant**, **multi-organization** operations.

This repository intentionally implements only the domain base needed to support future modules while preserving critical educational and administrative history.

## Functional foundations implemented

### 1) Identity split: person ≠ account ≠ role
- **Person** (`personId`): the human identity (civil identity layer).
- **Login account** (`accountId`): authentication/access identity linked to a person.
- **Educational role assignment** (`roleAssignmentId`): contextual role of a person in an organization over time.

### 2) Distinct educational identifiers
- **Learner profile** uses `learnerId`.
- **Enrollment records** must use a separate `enrollmentId`.
- This prevents lifecycle collisions between a learner's long-lived profile and enrollment events.

### 3) Organization identity model
- Internal organization identity is `organizationId` (permanent, non-semantic, opaque).
- National registry references (such as `nationalInstitutionId`) are external identifiers and remain separate.

### 4) Governance model: authorization ≠ accreditation
- **Authorization** captures permissions or legal scopes granted by authorities.
- **Accreditation** captures quality/curriculum recognition under a framework.
- They are modeled independently to avoid policy and compliance ambiguity.

### 5) Lifecycle/history primitives
- Lifecycle events are append-oriented (`appendLifecycleRecord`) to preserve historical facts.
- Documents are versioned and auditable through append-only version chains (`appendDocumentVersion`).

### 6) Identifier policy
- Internal identifiers are generated as opaque UUIDs.
- IDs are permanent and non-semantic by design.

### 7) Country-specific configuration hooks
- `createCountryConfigurationRegistry` provides per-country policy hooks.
- Enables country-level validation and configuration without hard-coding local rules into core domain entities.

## Current source structure

```text
src/
  app/
    bootstrap.js               # application bootstrap
  core/
    domain/
      access.js                # authorization + accreditation primitives
      country-config.js        # country-specific configuration hooks
      documents.js             # auditable, version-aware document model
      identifiers.js           # opaque internal identifier generation
      identity.js              # person/account/educational role + learner profile
      lifecycle.js             # append-oriented lifecycle helpers
      organization.js          # tenant + organization identity primitives
  index.js                     # app entrypoint

test/
  foundation.test.js           # foundation business-rule sanity checks
```

## Future module targets
This foundation is prepared for incremental addition of:
- academics
- enrollments
- documents/credentials
- audit/events
- validation/configuration by country

## Run locally

```bash
npm test
npm start
```

The current implementation is intentionally compact and modular to serve as a base for a future modular-monolith architecture.
