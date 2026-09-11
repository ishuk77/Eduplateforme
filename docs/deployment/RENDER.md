# Déploiement sur Render

Le Blueprint [`render.yaml`](../../render.yaml) crée un service web Node.js et
une base PostgreSQL managée. Le build exécute `npm ci`, le démarrage exécute
`npm start` et Render sonde `GET /health`.

## Configuration

1. Créer un Blueprint Render depuis ce dépôt.
2. Définir `CORS_ORIGIN` avec l'origine HTTPS publique du frontend/service.
3. Laisser Render injecter `DATABASE_URL` depuis `eduplateforme-db`.
4. Conserver les valeurs générées par Render pour `JWT_SECRET` et
   `DATA_ENCRYPTION_KEY`; ne jamais les placer dans Git.

En production, le processus refuse de démarrer si `DATABASE_URL`,
`CORS_ORIGIN`, `JWT_SECRET` ou `DATA_ENCRYPTION_KEY` est absent ou invalide.
Le serveur écoute `process.env.PORT` sur `0.0.0.0`.

## Persistance et migrations

Les migrations `src/db/migrations/*.sql` sont appliquées dans l'ordre et
enregistrées dans `schema_migrations`. PostgreSQL est utilisé dès que
`DATABASE_URL` commence par `postgres://` ou `postgresql://`. SQLite reste
disponible pour le développement et les tests.

L'API ne reçoit actuellement aucun upload binaire : les documents et travaux
stockent seulement des références (`storageReference`/`contentReference`).
Ces références doivent cibler un stockage objet durable. Aucun disque Render
n'est donc monté pour l'instant.

## Vérification

```bash
curl --fail https://VOTRE-SERVICE.onrender.com/health
```

Une réponse `200` contient `status: "ok"` et le dialecte de base actif. Une
base inaccessible produit `503` afin que Render ne considère pas l'instance
comme saine.
