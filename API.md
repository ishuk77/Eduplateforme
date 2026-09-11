# API

## Authentication
- `POST /auth/login`
- `POST /auth/refresh`
- `DELETE /auth/logout`
- `GET /auth/me`

## Protected CRUD examples
Each protected route expects a ****** in the `Authorization` header.

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

## Example login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"super-secret-password","organizationId":"<orgId>"}'
```
