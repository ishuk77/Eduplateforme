# Matrice rôles et permissions

| Rôle | Vue principale | Permissions typiques |
|---|---|---|
| Administrateur | exploitation globale | toutes les permissions tenant |
| Direction | effectifs, résultats, qualité | analytics, rapports, audit en lecture |
| Enseignant | classe, assiduité, résultats | cours, devoirs, notes et présences assignés |
| Apprenant | résultats et progression propres | lecture contextualisée |
| Parent | enfants autorisés | lecture contextualisée par relation |
| Étudiant universitaire | crédits, LMS, résultats | lecture de son parcours |
| Formateur | cohortes et progression | LMS contextualisé |
| Finance | inscriptions, factures, paiements | finance et analytics finance |
| Support | tickets, incidents, qualité technique | support et opérations selon niveau |

La présence d’un écran ne donne jamais une permission. L’API vérifie systématiquement le tenant et le code de permission. Les règles contextuelles restreignent classe, programme, site ou apprenant.
