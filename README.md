# Eduplateforme

Eduplateforme is a compact, production-oriented foundation for an international, multi-tenant education platform.

## Current implementation status

The repository now includes both:

1. the original foundation (identity, organizations, academics, documents, audit, authorization)
2. the functional platform modules required by the detailed specification:
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
3. the responsive web/mobile shell assets connected to live backend metadata/auth endpoints

## Consolidated security baseline

- JWT access + refresh token flow: `POST /auth/login`, `POST /auth/refresh`, `DELETE /auth/logout`, `GET /auth/me`
- Role/permission checks on protected routes (for example `organizations.*`, `people.*`, `accounts.*`, `academics.*`, `documents.*`, `credentials.*`, `audit.read`)
- Multi-tenant organization isolation enforced through token organization scope
- Input validation (JSON parsing, blocked suspicious payload patterns, zod schemas on auth/account creation)
- Consistent API error payloads with explicit status codes

### Still to harden in future iterations

- Rotate and externalize production secrets (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`)
- Add brute-force protection per account on authentication endpoints
- Expand fine-grained field-level authorization and audit review workflows

## Project structure

```text
public/           Front-end shell assets
src/
  application/    Minimal orchestration services and invariants
  domain/         Core business entities grouped by boundary
  http/           Lightweight API layer
  services/       Domain orchestration services
  shared/         Shared primitives and validation helpers
test/             Node:test coverage for foundation, integration, and shell behavior
```

## Getting started

```bash
npm install
npm test
npm start
```

## Render deployment

The application is deployable through [`render.yaml`](render.yaml) with a
managed PostgreSQL database, automatic migrations, production secret
validation, explicit `PORT`/`0.0.0.0` binding, and a database-aware health
check. See [`docs/deployment/RENDER.md`](docs/deployment/RENDER.md).

> Security note: `.env.example` contains no secret value. Render generates the
> production secrets, and local Docker requires them through environment
> variables.

## Core API coverage now available

- Organizations: create + list/read/update/archive/history
- People and user accounts: create + list/read/update/archive/history
- Academics (`years`, `programs`, `classes`, `enrollments`): create + list/read/update/archive/history
- Documents and credentials: create + list/read/update/archive/history + version/revision routes
- Audit/meta: `/audit/trail`, `/audit/events`, `/meta/foundation`, `/meta/invariants`, `/meta/openapi`
