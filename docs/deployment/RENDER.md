# Déploiement sur Render

Le Blueprint [`render.yaml`](../../render.yaml) crée un service web Node.js et
une base PostgreSQL managée. Le build exécute `npm ci`, le démarrage exécute
`npm start` et Render sonde `GET /health`.

## Configuration

1. Créer un Blueprint Render depuis ce dépôt.
2. Vérifier `CORS_ORIGIN`. Le Blueprint utilise
   `https://eduplateforme-yrgs.onrender.com`; adaptez cette variable si le nom
   du service change.
3. Laisser Render injecter `DATABASE_URL` depuis `eduplateforme-db`.
4. Conserver les valeurs générées par Render pour `JWT_SECRET` et
   `DATA_ENCRYPTION_KEY`; ne jamais les placer dans Git.
5. Conserver `DOMAIN_PROVIDER_MODE=disabled` tant qu’un contrat registrar,
   un compte prépayé et un flux de paiement authentifié ne sont pas prêts.

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

Après le déploiement, ouvrez l’URL publique et utilisez **Créer un compte**.
L’onboarding crée la première organisation et le rôle administrateur associé;
aucune initialisation manuelle de PostgreSQL n’est requise.

## Revente de domaines

Le déploiement par défaut **ne peut acheter aucun domaine**. Les commandes
restent `pending_payment`; une inscription n’est soumise qu’après confirmation
manuelle auditée par un administrateur plateforme ou, à terme, après un webhook
de paiement authentifié. Aucun webhook de paiement n’est inclus dans cette
version.

Modes disponibles :

- `DOMAIN_PROVIDER_MODE=disabled` : aucun devis registrar ni achat;
- `DOMAIN_PROVIDER_MODE=manual` : registre interne seulement, sans transaction;
- `DOMAIN_PROVIDER_MODE=openprovider` : adaptateur HTTPS `/v1`, activé uniquement
  si `OPENPROVIDER_USERNAME`, `OPENPROVIDER_PASSWORD`,
  `OPENPROVIDER_OWNER_HANDLE`, `OPENPROVIDER_ADMIN_HANDLE`,
  `OPENPROVIDER_BILLING_HANDLE` et `OPENPROVIDER_TECH_HANDLE` existent.

Variables facultatives : `OPENPROVIDER_BASE_URL` (défaut
`https://api.openprovider.eu/v1`), `OPENPROVIDER_ENVIRONMENT`,
`OPENPROVIDER_TIMEOUT_MS` et `DOMAIN_PROVIDER_LOW_BALANCE_THRESHOLD`.
Les identifiants restent exclusivement dans l’environnement Render. L’API et
l’interface n’exposent qu’un état masqué et ne journalisent jamais ces valeurs.

Avant toute activation live :

1. signer le contrat revendeur et financer le solde registrar;
2. configurer un fournisseur de paiement et son webhook signé;
3. vérifier les prix de vente/renouvellement et dates d’effet dans le catalogue;
4. exécuter une commande de bout en bout dans un environnement registrar de test;
5. configurer le CNAME/TXT externe et ajouter le domaine dans Render afin que le
   certificat TLS soit émis;
6. tester les notifications à 60, 30, 15 et 7 jours et la procédure de transfert.

L’institution reste le titulaire et propriétaire du domaine. Eduplateforme est
revendeur et gestionnaire technique. Les frais SaaS (mensuels ou annuels) et de
domaine (annuels) sont des lignes distinctes. Une promotion de première année ne
modifie pas le prix de renouvellement annoncé. La résiliation ne verrouille pas
le domaine : le transfert reste possible et la conservation des données suit la
période de grâce contractuelle. Les remboursements exigent une réconciliation
manuelle avec le paiement et le registrar; aucun échec fournisseur ne doit être
présenté comme payé ou enregistré.

Les administrateurs d’institution utilisent `/domain-subscription`, qui
n’expose que les offres de détail et les données de leur institution. Le rôle
`platform-admin` utilise `/platform/domain-reseller` pour le fournisseur, le
solde, les coûts/marges, les commandes globales, les incidents et l’audit.
L’ancien lien `/domain-reseller` est conservé comme redirection déterminée côté
serveur selon le rôle.
