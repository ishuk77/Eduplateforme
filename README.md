# Eduplateforme

Eduplateforme is the initial foundation for an API-first, multi-tenant education platform.

## Current scope

This first implementation phase intentionally stays small while creating stable domain boundaries for the MVP:

- organizations and tenant-ready identity boundaries
- people separated from user accounts and educational roles
- role and permission primitives
- academic structure primitives
- enrollment lifecycle tracking
- document and credential primitives
- audit-ready domain events
- country-specific validation hooks

## Project structure

```text
src/
  application/     Minimal orchestration services
  domain/          Core business entities grouped by boundary
  http/            Lightweight API stubs
  shared/          Shared primitives and validation helpers
test/              Sanity tests for the foundation
```

## Design choices

- **Permanent identifiers** use UUIDs and never encode business meaning.
- **Person, account, and role assignment are separate concerns** so one person can evolve across institutions and responsibilities.
- **Organization references are split** between internal references and country/national identifiers.
- **Lifecycle history is preserved** through statuses, timestamps, and audit events instead of destructive deletion.
- **Country rules are pluggable** through a registry that can validate future country-specific identifiers and constraints.

## Minimal API surface

The repository currently exposes lightweight HTTP stubs:

- `GET /health`
- `GET /meta/foundation`

These endpoints provide a stable entry point for future API work without prematurely committing to a full framework.

## Getting started

```bash
npm install
npm test
npm start
```

## Roadmap

Next implementation phases can add:

1. persistent storage and migrations
2. authenticated API workflows
3. tenant isolation enforcement
4. richer academic operations
5. document issuance workflows
6. background processing and integration events
