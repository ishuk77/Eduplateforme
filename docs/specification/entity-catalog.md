# Catalogue entités et relations

- **Organisation** est la racine d’isolation. Une organisation peut avoir des campus, programmes, comptes membres et abonnements.
- **Personne**, **compte**, **rôle** et **profil métier** restent distincts. Un compte référence une personne; les rôles sont affectés par organisation.
- **Apprenant** et **inscription** restent distincts. Une inscription relie apprenant, classe, programme et année.
- **Cours**, **matière**, **classe**, **période** et **programme** portent les dimensions analytics.
- **Note**, **présence**, **progression LMS**, **paiement** et **exécution qualité** sont les sources d’indicateurs.
- **Ticket support** conserve commentaires, priorité, niveau L1–L4, état et historique.
- **Plan SaaS** expose fonctionnalités et quotas; **abonnement tenant** porte essai, renouvellement et suspension.
- **Opération de sauvegarde** journalise intention, état fournisseur, intégrité, RPO et RTO.
- **Demande IA** conserve consentement, finalité, état fournisseur et autorité humaine.
