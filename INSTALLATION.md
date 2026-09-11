# Installation et exécution

## Pré-requis
- Node.js 22+

## Installation
```bash
npm install
```

## Initialiser la base
Par défaut, SQLite est créé dans `data/eduplateforme.sqlite`.

```bash
npm run db:migrate
```

Pour forcer un chemin:
```bash
DATABASE_PATH=/chemin/eduplateforme.sqlite npm run db:migrate
```

## Lancer l’application
```bash
npm run start
```

Endpoint de vérification:
- `GET /health`

Exemple minimal de création d’organisation:
- `POST /organizations`
- JSON: `{ "name": "Lycée Horizon", "code": "LYC-HOR" }`

## Tests
```bash
npm test
```

## Ce qui est persisté aujourd’hui
La couche SQLite couvre les domaines essentiels suivants:
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

## Ce qui reste en chantier
- Couverture fonctionnelle complète des modules métier avancés
- API REST complète (lecture, mise à jour, suppression sur tous les domaines)
- Sécurité d’authentification/autorisation complète
- Intégration frontend complète
