# Règles de validation

- Toute écriture métier est tenant-scoped et auditée.
- Les filtres analytics acceptés sont période, niveau, classe, programme, site et matière; les permissions restent vérifiées avant calcul ou export.
- Les agrégats sous le seuil configuré sont supprimés, pas arrondis ni pseudonymisés.
- Les notes, credentials, documents, sanctions et paiements ne sont jamais synchronisés hors ligne sans retour en ligne et confirmation.
- Les mutations offline autorisées exigent une clé d’idempotence et détectent un conflit par `updatedAt`.
- Une fonctionnalité SaaS est refusée si elle n’appartient pas au plan ou si un quota utilisateur/stockage serait dépassé.
- L’assistance IA exige un consentement explicite et refuse admission, exclusion, sanction, promotion, diplôme et note finale.
- Les configurations de fournisseur refusent les champs ressemblant à des secrets.
