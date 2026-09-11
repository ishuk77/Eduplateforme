# Plan de tests

La non-régression couvre les 30 tests des couches précédentes et les scénarios finaux:

1. dashboards distincts par rôle et permissions;
2. analytics, filtres, seuil de confidentialité et exports CSV/JSON;
3. politique offline, idempotence et conflits;
4. enrôlement, confirmation, challenge, recovery et désactivation MFA;
5. rate limiting d’authentification;
6. sauvegarde `pending_external`;
7. tickets, commentaires, états et niveaux;
8. entitlements et quotas;
9. garde-fous IA;
10. redaction des métriques;
11. structure DOM/accessibilité et assets offline;
12. persistance asynchrone PostgreSQL/pg-mem.

Validation finale: Node 22.13.1, `npm test`, `git diff --check`, revue navigateur des nouveaux écrans et audit des 57 sections.
