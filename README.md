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
3. l’application web/mobile fonctionnelle connectée aux API réelles :
   - landing publique, inscription, connexion et déconnexion
   - création guidée de la première école avec rôle administrateur
   - tableau de bord alimenté par les API
   - listes et formulaires pour tous les modules de navigation
   - écrans opérationnels pour devoirs/soumissions/notation, notes et
     moyennes, assiduité, emplois du temps, finances, notifications,
     académies virtuelles, certificats, localisation et consentements parentaux

## Créer le premier compte et tester

1. Démarrez l’application avec Node.js 22.13 ou supérieur : `npm ci`, puis
   `npm start`.
2. Ouvrez `http://localhost:3000`.
3. Choisissez **Créer un compte**, renseignez le profil et un mot de passe
   d’au moins 10 caractères.
4. Créez la première école. Le compte reçoit automatiquement le rôle
   **Administrateur de l’organisation** pour cette école uniquement.
5. Le tableau de bord s’ouvre. Pour tester un parcours complet, créez une
   personne, puis une année scolaire, un programme, une classe, un apprenant
   et une inscription.

Le jeton d’accès reste limité à l’onglet (`sessionStorage`). Le jeton de
renouvellement est conservé dans un cookie `HttpOnly`, `SameSite=Strict` et
`Secure` en production. Les erreurs de validation ou de permission sont
affichées par l’interface; aucune donnée ni réussite n’est simulée.

## Consolidated security baseline

- JWT access + refresh token flow: `POST /auth/register`, `POST /auth/login`, `POST /auth/onboarding`, `POST /auth/refresh`, `DELETE /auth/logout`, `GET /auth/me`
- Role/permission checks on protected routes (for example `organizations.*`, `people.*`, `accounts.*`, `academics.*`, `documents.*`, `credentials.*`, `audit.read`)
- Multi-tenant organization isolation enforced through token organization scope
- Input validation (JSON parsing, blocked suspicious payload patterns, zod schemas on auth/account creation)
- Consistent API error payloads with explicit status codes

### Limites connues

- Rotate and externalize production secrets (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`)
- Add brute-force protection per account on authentication endpoints
- Expand fine-grained field-level authorization and audit review workflows
- Les documents stockent une référence vers un stockage externe; aucun upload
  binaire n’est inclus dans ce MVP.
- L’envoi externe (courriel, SMS, push), le stockage du contenu des devoirs et
  le rendu PDF des certificats restent délégués à des fournisseurs externes;
  l’interface n’affiche un envoi que lorsque l’API l’a réellement marqué.

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
- Opérations: devoirs et soumissions, barèmes/notes, présence, planning,
  frais/factures/paiements, notifications, académie virtuelle, certificats,
  localisation et consentements parentaux (CRUD tenant-scoped et historique
  lorsque la ressource est archivable)
