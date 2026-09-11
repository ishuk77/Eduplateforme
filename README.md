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
3. the responsive web/mobile shell assets that can be connected to live backend workflows

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
