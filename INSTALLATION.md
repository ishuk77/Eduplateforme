# Installation

## Prérequis

- Node.js 22 LTS (22.13 ou supérieur)
- npm

## Développement local avec SQLite

```bash
cp .env.example .env
npm ci
npm test
npm start
```

Sans `DATABASE_URL`, l'application utilise `DB_URL`, puis
`sqlite:./data/eduplateforme.sqlite`. Le dossier `data/` est ignoré par Git.

Définissez des valeurs locales d'au moins 32 caractères pour `JWT_SECRET` et
`DATA_ENCRYPTION_KEY` si vous testez l'authentification ou les données chiffrées.

## Développement local avec PostgreSQL

Définissez `POSTGRES_PASSWORD`, `JWT_SECRET` et `DATA_ENCRYPTION_KEY` dans
votre environnement, puis lancez :

```bash
docker compose up --build
```

Le service applique automatiquement les migrations versionnées au démarrage.
