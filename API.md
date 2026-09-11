# API

## Authentication
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/onboarding`
- `POST /auth/refresh`
- `DELETE /auth/logout`
- `GET /auth/me`
- `GET /auth/validate`

`POST /auth/register` crée une personne et un compte sans organisation.
`POST /auth/onboarding`, appelé avec le jeton d’accès obtenu, crée la première
organisation, rattache le compte et attribue le rôle administrateur tenant.
Les réponses d’authentification n’exposent jamais le jeton de renouvellement
dans le JSON. Il est déposé uniquement dans un cookie `HttpOnly`,
`SameSite=Strict` (`Secure` en production). `POST /auth/refresh` et
`DELETE /auth/logout` utilisent ce cookie.

## Security model
- Protected routes require an `Authorization` header with a bearer access token.
- Access is permission-based and organization-scoped.
- Include `organizationId` in query/body when listing scoped data.
- Contextual RBAC rules: CRUD + history at `/security/contextual-permissions`.
  Each rule binds a role, resource, action, effect, and scope
  (`organization`, `site`, `program`, `class`, `learner`, `own`) without
  changing account memberships.

## Core foundation domains

### Organizations
- `POST /organizations`
- `GET /organizations`
- `GET /organizations/:id`
- `PUT /organizations/:id`
- `DELETE /organizations/:id` (archive)
- `GET /organizations/:id/history`

L’identifiant technique `organizationId`, l’identifiant institutionnel
national, les identifiants locaux de site et les références internes sont des
champs distincts. Une organisation peut aussi porter sa forme juridique, son
immatriculation, son identifiant fiscal, son autorité administrative, son état
opérationnel, son siège et son contact officiel.

### Institution, réglementation et vérification
- CRUD + historique : `/institution/campuses`
- CRUD + historique : `/institution/operating-authorizations`
- CRUD + historique : `/institution/accreditations`
- CRUD + historique : `/institution/verifications`
- `POST /institution/operating-authorizations/:id/transition`
- `POST /institution/accreditations/:id/transition`
- `POST /institution/verifications/:id/transition`
- `GET /public/institutions/verify/:code` (public, limité aux champs publiables)

Les autorisations de fonctionnement et les accréditations sont deux collections
indépendantes. Les transitions conservent le motif, l’autorité, la preuve et
l’horodatage. Les statuts publics sont `UNVERIFIED`, `PENDING_VERIFICATION`,
`VERIFIED`, `VERIFIED_BY_AUTHORITY`, `SUSPENDED` et `REVOKED`.

### Profils métier
- CRUD + historique : `/profiles/guardians`
- CRUD + historique : `/profiles/professionals`
- CRUD + historique : `/profiles/guardian-relations`
- `POST /profiles/guardian-relations/:id/withdraw`
- CRUD + historique : `/profiles/professional-assignments`

Ces profils référencent une `Person` sans créer de nouveau `Account`. Les
relations responsables-apprenants portent leurs propres permissions et peuvent
être retirées; les affectations professionnelles sont contextualisées par
organisation et, facultativement, par campus.

### People
- `POST /users` (backward-compatible alias)
- `POST /people`
- `GET /people`
- `GET /people/:id`
- `PUT /people/:id`
- `DELETE /people/:id` (archive)
- `GET /people/:id/history`

### Accounts
- `POST /accounts`
- `GET /accounts`
- `GET /accounts/:id`
- `PUT /accounts/:id`
- `DELETE /accounts/:id` (archive)
- `GET /accounts/:id/history`

### Academics
- `POST /academics/years`
- `GET /academics/years`
- `GET /academics/years/:id`
- `PUT /academics/years/:id`
- `DELETE /academics/years/:id` (archive)
- `GET /academics/years/:id/history`
- `POST /academics/programs`
- `GET /academics/programs`
- `GET /academics/programs/:id`
- `PUT /academics/programs/:id`
- `DELETE /academics/programs/:id` (archive)
- `GET /academics/programs/:id/history`
- `POST /academics/classes`
- `GET /academics/classes`
- `GET /academics/classes/:id`
- `PUT /academics/classes/:id`
- `DELETE /academics/classes/:id` (archive)
- `GET /academics/classes/:id/history`
- `POST /academics/enrollments`
- `GET /academics/enrollments`
- `GET /academics/enrollments/:id`
- `PUT /academics/enrollments/:id`
- `DELETE /academics/enrollments/:id` (archive)
- `GET /academics/enrollments/:id/history`
- CRUD + historique : `/academics/periods` (semestres/trimestres)
- CRUD + historique : `/academics/levels`
- CRUD + historique : `/academics/subjects`
- CRUD + historique : `/academics/courses`
- `POST /academics/lifecycle-events`
- `GET /academics/lifecycle-events`
- `GET /academics/lifecycle-events/:id`
- `GET /academics/lifecycle-events/:id/history`

`Subject` décrit la matière; `Course` l’instancie pour une période, un groupe
ou programme et des affectations enseignantes. Le journal longitudinal accepte
admission, inscription, promotion, redoublement, changements, suspension,
reprise, abandon, exclusion, diplôme, certification, décès et archivage avec
ancien/nouveau contexte, motif, preuve et autorité.

### Documents and credentials
- `POST /documents`
- `GET /documents`
- `GET /documents/:id`
- `PUT /documents/:id`
- `DELETE /documents/:id` (archive)
- `GET /documents/:id/history`
- `POST /documents/versions`
- `POST /credentials`
- `GET /credentials`
- `GET /credentials/:id`
- `PUT /credentials/:id`
- `DELETE /credentials/:id` (archive)
- `GET /credentials/:id/history`
- `POST /credentials/revisions`

## Additional secured modules

### Grading
- `POST /grading/systems`
- `GET /grading/systems`
- `GET /grading/systems/:id`
- `PUT /grading/systems/:id`
- `DELETE /grading/systems/:id`
- `GET /grading/systems/:id/history`
- `POST /grading/grades`
- `GET /grading/grades`
- `GET /grading/grades/:id`
- `PUT /grading/grades/:id`
- `DELETE /grading/grades/:id` (archive)
- `GET /grading/grades/:id/history`
- `GET /grading/average?organizationId=<orgId>&learnerId=<learnerId>`

### Attendance
- `POST /attendance/records`
- `GET /attendance/records`
- `GET /attendance/records/:id`
- `PUT /attendance/records/:id`
- `DELETE /attendance/records/:id` (archive)
- `GET /attendance/records/:id/history`
- `GET /attendance/rate?organizationId=<orgId>&learnerId=<learnerId>`

### Scheduling
- `POST /scheduling/entries`
- `GET /scheduling/entries`
- `GET /scheduling/entries/:id`
- `PUT /scheduling/entries/:id`
- `DELETE /scheduling/entries/:id`
- `GET /scheduling/entries/:id/history`

### Assignments
- `POST /assignments`
- `GET /assignments`
- `GET /assignments/:id`
- `PUT /assignments/:id`
- `DELETE /assignments/:id` (archive)
- `GET /assignments/:id/history`
- `POST /assignments/submissions`
- `GET /assignments/submissions`
- `GET /assignments/submissions/:id`
- `PUT /assignments/submissions/:id`
- `DELETE /assignments/submissions/:id`
- `GET /assignments/submissions/:id/history`
- `POST /assignments/submissions/grade`

### Finance
- `POST /finance/fees`
- `GET /finance/fees`
- `GET /finance/fees/:id`
- `PUT /finance/fees/:id`
- `DELETE /finance/fees/:id` (archive)
- `GET /finance/fees/:id/history`
- `POST /finance/invoices`
- `GET /finance/invoices`
- `GET /finance/invoices/:id`
- `PUT /finance/invoices/:id`
- `DELETE /finance/invoices/:id` (archive)
- `GET /finance/invoices/:id/history`
- `POST /finance/payments`
- `GET /finance/payments`
- `GET /finance/payments/:id`
- `PUT /finance/payments/:id`
- `DELETE /finance/payments/:id` (archive)
- `GET /finance/payments/:id/history`

### Notifications and governance
- `POST /notifications`
- `GET /notifications`
- `GET /notifications/:id`
- `PUT /notifications/:id`
- `DELETE /notifications/:id`
- `GET /notifications/:id/history`
- `POST /notifications/sent`
- `POST /virtual-schools`
- `GET /virtual-schools`
- `POST /virtual-schools/trainings`
- `GET /virtual-schools/trainings`
- `POST /certificates`
- `GET /certificates`
- `POST /i18n/profile`
- `GET /i18n/profile`
- `POST /i18n/profiles` et `GET /i18n/profiles` (collection pour l’interface)
- `POST /security/parental-consents`
- `GET /security/parental-consents`

Les académies virtuelles, formations, certificats et consentements exposent
également les variantes `GET /:id`, `PUT /:id`, `DELETE /:id` et
`GET /:id/history`. Toutes les listes sont filtrées par l’organisation du
jeton; `organizationId` reste obligatoire pour un compte multi-organisation.

## Protected CRUD examples
Each protected route expects a bearer token in the `Authorization` header.

### Calendar
- `GET /calendar/events?organizationId=<orgId>`
- `GET /calendar/events/:id`
- `POST /calendar/events`
- `PUT /calendar/events/:id`
- `DELETE /calendar/events/:id`
- `GET /calendar/events/:id/history`

### Discipline
- `GET /discipline/records?organizationId=<orgId>`
- `GET /discipline/records/:id`
- `POST /discipline/records`
- `PUT /discipline/records/:id`
- `DELETE /discipline/records/:id`
- `GET /discipline/records/:id/history`

### Reports
- `GET /reports/cards?organizationId=<orgId>`
- `GET /reports/cards/:id`
- `POST /reports/cards`
- `PUT /reports/cards/:id`
- `DELETE /reports/cards/:id`
- `GET /reports/cards/:id/history`

### Communications
- `GET /communications/threads?organizationId=<orgId>`
- `GET /communications/messages?organizationId=<orgId>`
- `POST /communications/threads`
- `POST /communications/messages`
- `PUT /communications/threads/:id`
- `PUT /communications/messages/:id`
- `DELETE /communications/threads/:id`
- `DELETE /communications/messages/:id`
- `GET /communications/threads/:id/history`
- `GET /communications/messages/:id/history`

### Subscriptions
- `GET /subscriptions/platform?organizationId=<orgId>`
- `GET /subscriptions/platform/:id`
- `POST /subscriptions/platform`
- `PUT /subscriptions/platform/:id`
- `DELETE /subscriptions/platform/:id`
- `GET /subscriptions/platform/:id/history`

## Audit
- `GET /audit/trail?organizationId=<orgId>&limit=25&offset=0`
- `GET /audit/events?organizationId=<orgId>&limit=25&offset=0`

## Meta
- `GET /meta/foundation`
- `GET /meta/invariants`
- `GET /meta/openapi`

## Example login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"super-secret-password","organizationId":"<orgId>"}'
```
