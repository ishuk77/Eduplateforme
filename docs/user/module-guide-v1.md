# Guide des modules Eduplateforme — v1

Ce guide couvre l’interface disponible en français, anglais, espagnol, portugais et arabe. La navigation générale, les états communs, les pays et les formats `Intl` sont localisés. Certains libellés métier restent en français de référence lorsqu’une traduction dédiée n’existe pas; le fallback n’est jamais vide. L’arabe active une mise en page de droite à gauche.

## Ordre de configuration

1. **Organisation et sites** — droits `organizations.*` et `institution.*`; créez l’établissement, ses campus et sa localisation.
2. **Structure académique** — droits `academics.*`; créez année, périodes, niveaux, programmes, classes, matières puis cours.
3. **Identités et rôles** — droits `people.*`, `profiles.*`, `accounts.*`; créez les personnes, profils métier, affectations et comptes.
4. **Inscriptions** — droit `academics.write`; créez manuellement ou importez les apprenants dans une classe existante.

Chaque écran de module renvoie vers `/help`. Une liste de référence indique explicitement son état de chargement, son erreur ou le prérequis à créer.

## Opérations quotidiennes

Les modules inscriptions, emplois du temps, devoirs, présences, notes, LMS, finances, communications et documents n’apparaissent que si le rôle possède la permission de lecture correspondante. Les écritures requièrent la permission `*.write`. Le tableau de bord ne calcule et n’affiche que les indicateurs autorisés et propose des prochaines actions adaptées aux rôles administrateur plateforme, administrateur école, administrateur université, administrateur centre de formation, apprenant/étudiant, enseignant/formateur et parent/tuteur.

## Import CSV/XLSX

Les imports nécessitent `academics.write`, une connexion en ligne et une confirmation après dry-run. Limites: 5 Mio, 1 000 lignes de données et 20 colonnes. Les formules sont refusées, le fichier n’est jamais écrit sur disque et chaque ligne reçoit des erreurs explicites.

Schémas fixes:

- `learners`: `givenName,familyName,email,learnerNumber,classCode,createAccount`
- `class-roster`: `givenName,familyName,email,learnerNumber,createAccount` avec `classId` choisi dans l’interface
- `staff`: `givenName,familyName,email,professionalType,roleTitle,startsOn,campusCode,createAccount`

L’application réutilise une personne du tenant par courriel, un apprenant par numéro, puis évite une seconde inscription dans la même classe. Une clé d’idempotence empêche la répétition d’un lot. L’application finale est transactionnelle sous SQLite et PostgreSQL. Si `createAccount` vaut `true`, le résultat immédiat contient une seule fois les identifiants temporaires; seul le hash du mot de passe est stocké et la connexion impose un changement avant tout accès. Aucun courriel n’est envoyé sans fournisseur configuré.

## Gouvernance et exploitation

Audit, qualité des données, EMIS, sécurité, abonnements, support et exploitation sont réservés aux permissions correspondantes. Les opérations externes restent explicitement signalées comme telles. Les actions officielles, dont les imports, ne sont jamais placées dans la file hors ligne.
