# Déploiement Render (préparation pragmatique)

Ce dépôt contient maintenant une base serveur Node.js ESM minimale, déployable sur Render via `npm start`.

> État actuel: préparation technique au déploiement (bootstrap serveur + config + doc). La plateforme métier complète reste à consolider.

## 1) Prérequis

- Compte Render
- Node.js 20+
- Dépôt GitHub connecté à Render

## 2) Création du service web Render

1. Render → **New +** → **Web Service**
2. Sélectionner `ishuk77/Eduplateforme`
3. Paramètres recommandés:
   - **Runtime**: Node
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`

## 3) Variables d’environnement minimales

- `NODE_ENV=production`
- `PORT` *(injectée automatiquement par Render ; ne pas forcer une valeur fixe en production)*
- `JWT_SECRET` *(à définir dès que l’auth applicative est branchée)*
- `DATABASE_URL` *(à définir quand la couche persistance PostgreSQL est activée côté application)*

## 4) Base de données / persistance

- Le serveur actuel est un socle technique de démarrage et n’active pas encore une persistance métier complète.
- Si vous activez SQLite localement à terme, Render n’offre pas de persistance disque durable fiable pour une app multi-instance.
- Recommandation cible Render: PostgreSQL managé Render + variable `DATABASE_URL`.

## 5) Vérifications post-déploiement

Après déploiement:

- `GET /health` → doit renvoyer `{"ok":true}`
- `GET /` → doit renvoyer un JSON de statut du service
- Vérifier dans les logs Render: `Eduplateforme server listening on ...`

## 6) Limites connues

- Ce PR ne prétend pas livrer l’intégralité de la plateforme produit.
- Il prépare un démarrage Node.js fiable sur Render avec une documentation exploitable.
- Les briques métier (persistance complète, sécurité appliquée partout, APIs étendues, frontend complet) restent à consolider selon les PR/modules dédiés.

## 7) Dépannage basique

- **Le service ne démarre pas**: vérifier `npm ci` puis `npm start` en local.
- **Erreur `Invalid PORT value`**: corriger la variable `PORT`.
- **Port déjà utilisé en local**: changer `PORT` ou arrêter le processus occupant le port.
