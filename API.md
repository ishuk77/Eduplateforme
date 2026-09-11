# API

## Authentication
- `POST /auth/login`
- `POST /auth/refresh`
- `DELETE /auth/logout`
- `GET /auth/me`

## Security model
- Protected routes require an `Authorization` header with a bearer access token.
- Access is permission-based and organization-scoped.
- Include `organizationId` in query/body when listing scoped data.

## Core foundation domains

### Organizations
- `POST /organizations`
- `GET /organizations`
- `GET /organizations/:id`
- `PUT /organizations/:id`
- `DELETE /organizations/:id` (archive)
- `GET /organizations/:id/history`

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
