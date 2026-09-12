# Administration de la revente de domaines

Eduplateforme propose trois offres distinctes : **Essential** utilise un
sous-domaine de la plateforme, **Professional** relie un domaine déjà détenu par
l’institution et **Premium** peut inclure la gestion d’un domaine acheté. Le
premier tarif peut être promotionnel, mais le prix annuel de renouvellement est
toujours affiché séparément.

L’institution est le registrant et propriétaire. Eduplateforme est revendeur et
gestionnaire technique; aucune résiliation SaaS ne retire le droit au transfert.
Les coordonnées du registrant et son consentement sont requis avant commande.
Les codes d’autorisation de transfert ne sont jamais retournés dans les listes :
seul un condensat non réversible peut être conservé pour le suivi.

## États et contrôles

Le paiement et le domaine sont deux lignes de commande. Sans prestataire de
paiement, l’état reste `pending`; il ne devient `paid` qu’après une action
plateforme explicite, confirmée, motivée et auditée. Le cycle métier est
`pending_payment`, `pending_registration`, `pending_dns`, `pending_tls`,
`active`, `expiring`, `expired`, `suspended` ou `transfer_pending`. L’interface
tenant présente la chronologie simplifiée `payment_pending`, `domain_pending`,
`dns_pending`, `tls_pending`, `active`.

Les devis et commandes exigent une clé d’idempotence tenant. Les noms sont
normalisés et la contrainte d’unicité des domaines personnalisés existante reste
la source de vérité du routage. Les suspensions et transferts exigent la saisie
du domaine exact et un motif. Les transitions sont persistées et auditées sur
SQLite comme PostgreSQL.

## Exploitation

Le tableau plateforme expose uniquement les métadonnées nécessaires :
fournisseur/environnement, état masqué des identifiants, solde lorsqu’il est
disponible, seuil bas, dernière synchronisation/erreur, catalogue et états de
commande. Il ne permet pas de parcourir les données privées des tenants.

Pour un incident, conserver l’ordre dans son état courant, enregistrer le
diagnostic, réconcilier paiement et référence fournisseur, puis relancer
explicitement l’étape DNS/TLS. Ne jamais inscrire ou rembourser implicitement.
Les avis de renouvellement sont produits à 60, 30, 15 et 7 jours.
