# Installation

## Prerequisites
- Node.js 20+
- npm

## Local setup
```bash
npm install
cp .env.example .env
npm test
npm start
```

The default configuration uses SQLite via `DB_URL=sqlite:/tmp/eduplateforme/eduplateforme.sqlite`.

## Database
Migrations are applied automatically at startup from `src/db/migrations/`.

## Authentication bootstrap
If no account exists yet, the first organization, user, and account can be created through the bootstrap routes. Once an account exists, protected routes require JWT authentication.
