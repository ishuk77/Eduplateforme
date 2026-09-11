# Eduplateforme

Eduplateforme regroupe désormais les fondations métier initiales et une interface web responsive minimale dans un même serveur Node.js.

## Démarrage

```bash
npm install
npm start
```

Le serveur expose :
- l'application shell sur `/`, `/dashboard`, `/organizations`, `/people`, `/academics`, `/documents`, `/audit`
- les endpoints de fondation sur `/health`, `/meta/foundation`, `/meta/invariants`

## Vérification

```bash
npm test
```
