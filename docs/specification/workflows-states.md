# Workflows et états

- **MFA**: `pending -> enabled -> disabled`; la confirmation exige un TOTP valide, un recovery code est à usage unique.
- **Ticket**: `open -> in_progress -> waiting -> resolved -> closed`; niveau `L1 -> L4`, chaque commentaire ajoute une entrée d’historique.
- **Abonnement**: `trial -> active -> renewal_due -> suspended -> ended`; aucun débit externe n’est simulé.
- **Sauvegarde/PRA**: `pending_external -> running -> completed|failed`; l’intégrité reste `not_tested` tant qu’un fournisseur ne renvoie pas de résultat.
- **Offline**: `queued -> applied|conflict|requires_online_confirmation|rejected`; la clé d’idempotence empêche un double traitement.
- **IA**: `pending_external|processing -> completed|failed`; toute autorité de décision reste humaine.
- **Incident**: `open -> monitoring -> resolved`; le statut service est dégradé tant qu’un incident est ouvert.
