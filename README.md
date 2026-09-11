# Eduplateforme

Eduplateforme now combines a responsive application shell and a modular education-platform API in one Node.js server.

## Current implementation status

The repository includes:

1. the original foundation (identity, organizations, academics, documents, audit, authorization)
2. the extended functional modules:
   - grading and gradebook
   - attendance and absence tracking
   - scheduling
   - assignments and submissions
   - report cards
   - finance
   - notifications
   - communications
   - discipline
   - calendar
   - virtual schools and paid trainings
   - certificates
   - i18n profiles
   - platform subscriptions
   - parental consent and audit history
3. the responsive shell routes on `/`, `/dashboard`, `/organizations`, `/people`, `/academics`, `/documents`, `/audit`

## API surface

- `GET /health`
- `GET /meta/foundation`
- `GET /meta/invariants`
- `GET /meta/openapi`
- module routes under `/organizations`, `/users`, `/accounts`, `/academics/*`, `/grading/*`, `/attendance/*`, `/scheduling/*`, `/assignments/*`, `/communications/*`, `/finance/*`, `/reports/*`, `/discipline/*`, `/notifications/*`, `/calendar/*`, `/virtual-schools*`, `/certificates`, `/subscriptions/platform`, `/i18n/profile`, `/security/parental-consents`, `/audit/events`

## Getting started

```bash
npm install
npm test
npm start
```
