# Dictionnaire de données

Toutes les entités métier ont un identifiant UUID permanent, `status`, `createdAt`, `updatedAt` et, lors d’un archivage logique, `archivedAt`. Les dates sont des chaînes ISO 8601 UTC. `organizationId` est la frontière tenant obligatoire sauf pour les référentiels globaux.

| Domaine | Données principales | Données sensibles |
|---|---|---|
| Identité | personne, compte, rôle, permission, session | identifiants nationaux, courriel, hash de mot de passe |
| Académique | année, période, niveau, programme, classe, cours, inscription | parcours individuel |
| Évaluation | devoir, soumission, note, bulletin, présence | résultats et assiduité |
| Documents | modèle, document, credential, partage, transfert | fichiers, titulaire, consentement |
| LMS/EMIS | catalogue, progression, tentative, mapping, échange | réponses, progression, payload d’échange |
| Exploitation | configuration analytics, ticket, plan, abonnement, sauvegarde, incident | commentaires support, registre PRA |
| Sécurité | MFA, recovery codes, journal d’audit | secret MFA chiffré, recovery codes uniquement hashés |

Les payloads marqués sensibles sont chiffrés au repos par le repository. Les secrets de fournisseur ne sont pas acceptés dans les configurations métier.
