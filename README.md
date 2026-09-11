# Eduplateforme

Cette PR pose une **fondation persistante** pragmatique pour Eduplateforme.

## État actuel (honnête)
- Le dépôt fournit maintenant une base Node.js ESM cohérente.
- Les entités cœur sont persistées dans une base SQLite locale.
- Un service applicatif central (`PersistentEducationPlatformService`) orchestre la création des objets principaux et l’audit.
- Le projet n’implémente pas encore toute la vision produit (modules avancés, UI complète, sécurité complète, CRUD exhaustif).

## Base de données
- Fichier SQLite local par défaut: `data/eduplateforme.sqlite`
- Schéma: `/home/runner/work/Eduplateforme/Eduplateforme/src/db/schema.sql`
- Migration: `/home/runner/work/Eduplateforme/Eduplateforme/src/db/migrate.js`
- Repositories SQL: `/home/runner/work/Eduplateforme/Eduplateforme/src/db/repositories/`

### Domaines persistés
- organizations
- people
- user_accounts
- roles
- role_assignments
- academic_years
- programs
- classes
- enrollments
- documents
- credentials
- audit_events

## Commandes
```bash
npm install
npm run db:migrate
npm run start
npm test
```

## Variables utiles
- `DATABASE_PATH`: chemin du fichier SQLite (optionnel)
- `PORT`: port HTTP (optionnel, défaut `3000`)

Voir aussi: `INSTALLATION.md`
