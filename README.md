# Eduplateforme

Eduplateforme is a compact, production-oriented foundation for an international, multi-tenant education platform.

## Current implementation status

The repository now includes both:

1. the original foundation (identity, organizations, academics, documents, audit, authorization)
2. the missing functional modules required by the detailed specification:
   - grading and gradebook
   - attendance and absence tracking
   - scheduling
   - assignments and submissions
   - report cards
   - finance (fees, invoices, payments)
   - notifications
   - communications
   - discipline
   - calendar
   - virtual schools and paid trainings
   - certificates
   - i18n and localization profile
   - platform subscriptions
   - parental consent and expanded audit history

## Core invariants

- **person ≠ account ≠ role**: a human identity, a login surface, and an authorization assignment are separate records.
- **learner_id ≠ enrollment_id**: learner identity persists across academic movements, while each enrollment is a historical record.
- **organization_id ≠ national_institution_id**: internal technical IDs stay opaque and separate from country-facing institution identifiers.
- **authorization ≠ accreditation**: governance permissions are modeled independently from academic recognition and credentials.
- **documents and credentials are auditable and version-aware**: corrections create new records instead of destructive replacement.

## Project structure

```text
src/
  application/     Minimal orchestration services and invariants
  domain/          Core business entities grouped by boundary
  http/            Lightweight API stubs
  shared/          Shared primitives and validation helpers
test/              Node:test coverage for key invariants
```

## Domain modules

- **organizations**: legal/display names, internal references, national institution identifiers, local identifiers, and parent organization links.
- **people + accounts**: people keep civil identity data, while user accounts keep authentication identifiers and lifecycle state.
- **authorization**: permissions, roles, role assignments, and direct permission grants for governance exceptions.
- **academics**: academic years, programs, classes, learners, and enrollments with historical separation.
- **documents**: document records and credential records with explicit lineage and version numbers.
- **audit**: domain events carry ordered sequence numbers and correlation hooks for future traceability.
- **country rules**: validation hooks allow country-specific identifier rules without coupling core entities to a single jurisdiction.

## Design choices

- **Permanent identifiers** use UUIDs and never encode business meaning.
- **Person, account, learner, and role assignment are separate concerns** so one person can evolve across institutions and responsibilities without rewriting history.
- **Organization references are split** between local/internal references and national identifiers.
- **Lifecycle history is preserved** through statuses, timestamps, and audit events instead of destructive deletion.
- **Version corrections preserve prior records** by superseding documents and credentials instead of mutating them in place.
- **Country rules are pluggable** through a registry that can validate future country-specific identifiers and constraints.

## API surface

The repository exposes HTTP endpoints for foundation and module workflows:

- `GET /health`
- `GET /meta/foundation`
- `GET /meta/invariants`
- `GET /meta/openapi`
- module routes under `/organizations`, `/users`, `/accounts`, `/academics/*`, `/grading/*`, `/attendance/*`, `/scheduling/*`, `/assignments/*`, `/communications/*`, `/finance/*`, `/reports/*`, `/discipline/*`, `/notifications/*`, `/calendar/*`, `/virtual-schools*`, `/certificates`, `/subscriptions/platform`, `/i18n/profile`, `/security/parental-consents`, `/audit/events`

The API keeps strict validation and returns consistent JSON errors.

## Getting started

```bash
npm install
npm test
npm start
```

## What the current foundation is ready for

- storage adapters and migrations
- authenticated application workflows
- tenant isolation enforcement in repositories and APIs
- country packs for institution/person validation
- richer scheduling, grading, and credential issuance flows
- asynchronous integration/event delivery

## Next phases beyond this foundation

1. persistence and repository abstractions
2. authenticated operational APIs
3. deeper academic operations and transcript logic
4. accreditation/compliance workflows
5. background jobs and external integrations
