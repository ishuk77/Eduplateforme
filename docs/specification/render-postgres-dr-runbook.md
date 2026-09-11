# Runbook Render/PostgreSQL

Objectifs par défaut configurables: **RPO 24 h**, **RTO 8 h**.

1. Vérifier `/healthz`, `/readyz`, les métriques et le statut Render/PostgreSQL.
2. Déclarer l’incident, son niveau et le message public.
3. Identifier le dernier artefact fournisseur et sa preuve d’intégrité.
4. Lancer une restauration dans une base isolée, jamais sur la production directement.
5. Vérifier migrations, comptages tenant, authentification, audit et échantillons de documents.
6. Basculer après approbation humaine, journaliser l’heure et mesurer RPO/RTO réels.
7. Révoquer les sessions si une exposition est suspectée et produire le retour d’expérience.

Sans adaptateur de sauvegarde configuré, l’API enregistre `pending_external`; elle ne prétend pas qu’une sauvegarde a eu lieu.
