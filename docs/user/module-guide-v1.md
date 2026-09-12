# Guide des modules Eduplateforme — v1

Ce guide couvre l’interface disponible en français, anglais, espagnol, portugais et arabe. La navigation générale, les états communs, les pays et les formats `Intl` sont localisés. Certains libellés métier restent en français de référence lorsqu’une traduction dédiée n’existe pas; le fallback n’est jamais vide. L’arabe active une mise en page de droite à gauche.

## Ordre de configuration

1. **Organisation et sites** — droits `organizations.*` et `institution.*`; créez l’établissement, ses campus et sa localisation.
2. **Structure académique** — droits `academics.*`; créez année, périodes, niveaux, programmes, classes, matières puis cours.
3. **Identités et rôles** — droits `people.*`, `profiles.*`, `accounts.*`; créez les personnes, profils métier, affectations et comptes.
4. **Inscriptions** — droit `academics.write`; créez manuellement ou importez les apprenants dans une classe existante.

Chaque écran de module renvoie vers `/help`. Une liste de référence indique explicitement son état de chargement, son erreur ou le prérequis à créer.

### Organisation

**Rôle :** administrateur. **Prérequis :** compte personnel actif et authentifié. L’inscription crée d’abord ce compte; l’organisation est créée après connexion et d’autres institutions peuvent ensuite être ajoutées. Le type est choisi parmi école, université/enseignement supérieur et centre de formation. La `internalReference` est un code technique local, généré par le serveur et rendu unique dans le pays; l’identifiant national et les identifiants locaux restent distincts. Le fuseau utilise la liste IANA du navigateur avec un fallback sûr, le format de date montre un exemple, et latitude/longitude sont facultatives, validées ensemble et soumises à la politique de confidentialité. Les preuves se téléversent dans **Identité & preuves** avant d’être sélectionnées dans les workflows réglementaires.

### Référentiels

**Rôle :** administrateur de référentiels. **Prérequis :** organisation active. Un `catalog` regroupe une famille de valeurs (`levels`, `subjects`, `qualifications`); le `code` est la référence stable pour API/imports; les libellés FR/EN/ES/PT/AR sont affichables. La saisie manuelle et l’import CSV/XLSX suivent le même modèle : `catalog,code,labelFr,labelEn,labelEs,labelPt,labelAr,countryCode`. Le dry-run vérifie les colonnes, doublons et formules; l’application est transactionnelle, idempotente et limitée au tenant.

### Années, périodes et classes

**Rôle :** administrateur académique. **Prérequis :** organisation, puis année avant programme/classe/période. Le nom est le libellé affiché; le code est une référence technique stable. Le code d’année est dérivé des dates lorsqu’il est omis. La fin doit suivre le début. Une période possède un type, un numéro de séquence unique et des dates entièrement comprises dans l’année. Pour une classe, `name` désigne le groupe/section affiché (par exemple « 6e A ») et `code` son identifiant stable (par exemple `6A-2026`); cycle et niveau proviennent de choix/référentiels.

## Opérations quotidiennes

Les modules inscriptions, emplois du temps, devoirs, présences, notes, LMS, finances, communications et documents n’apparaissent que si le rôle possède la permission de lecture correspondante. Les écritures requièrent la permission `*.write`. Le tableau de bord ne calcule et n’affiche que les indicateurs autorisés et propose des prochaines actions adaptées aux rôles administrateur plateforme, administrateur école, administrateur université, administrateur centre de formation, apprenant/étudiant, enseignant/formateur et parent/tuteur.

## Import CSV/XLSX

Les imports nécessitent `academics.write`, une connexion en ligne et une confirmation après dry-run. Limites: 5 Mio, 1 000 lignes de données et 20 colonnes. Les formules sont refusées, le fichier n’est jamais écrit sur disque et chaque ligne reçoit des erreurs explicites.

Schémas fixes:

- `people`: `personType,givenName,familyName,email,phone,learnerNumber,gradeLevel,classCode,guardianGivenName,guardianFamilyName,guardianEmail,relationship,professionalType,roleTitle,startsOn,campusCode,createAccount,accountPolicy`
- `learners`: `givenName,familyName,email,learnerNumber,classCode,createAccount`
- `class-roster`: `givenName,familyName,email,learnerNumber,createAccount` avec `classId` choisi dans l’interface
- `staff`: `givenName,familyName,email,professionalType,roleTitle,startsOn,campusCode,createAccount`
- `references`: `catalog,code,labelFr,labelEn,labelEs,labelPt,labelAr,countryCode`

Pour `people`, `personType` accepte apprenant/étudiant/stagiaire, parent/responsable ou enseignant/formateur/staff. Les colonnes apprenant créent Person, profil apprenant, inscription et classe; les colonnes responsable créent profil et relation; les colonnes professionnelles créent profil et affectation. L’application réutilise une personne du tenant par courriel, un apprenant par numéro, puis évite une seconde inscription dans la même classe. Une clé d’idempotence empêche la répétition d’un lot. L’application finale est transactionnelle sous SQLite et PostgreSQL.

Si `createAccount` vaut `true`, un apprenant peut utiliser son matricule sans courriel. Préscolaire/maternelle et niveaux 1 à 4 appliquent par défaut `parent`; à partir du niveau 5, ou lorsque le niveau est inconnu, le fichier choisit explicitement `parent`, `learner` ou `both`. Un téléphone est un contact, jamais un identifiant de connexion sans OTP vérifié. Le résultat immédiat contient une seule fois les identifiants temporaires; seul le hash du mot de passe est stocké et la connexion impose un changement avant tout accès. Aucun courriel n’est envoyé sans fournisseur configuré.

### Activation par paiement

**Rôles :** administration/finance pour configurer et enregistrer, apprenant pour consulter son état. **Prérequis :** inscription active, frais et facture si le programme n’est pas gratuit. La politique peut être `no_payment_required`, `registration_fee_paid`, `minimum_percentage`, `minimum_amount` ou `fully_paid`, au niveau institutionnel ou d’un programme. Une formation gratuite contourne explicitement le paiement. Le tableau de bord existe immédiatement, mais le serveur masque notes, présence, progression et contenus LMS tant que le critère n’est pas atteint; l’écran affiche seulement un état d’attente sans fuite de données. Les opérations administrateur/enseignant restent régies par leurs permissions.

## Gouvernance et exploitation

Audit, qualité des données, EMIS, sécurité, abonnements, support et exploitation sont réservés aux permissions correspondantes. Les opérations externes restent explicitement signalées comme telles. Les actions officielles, dont les imports, ne sont jamais placées dans la file hors ligne.

### Comptes de démonstration des rôles

Un administrateur du tenant peut appeler une fois `POST /operations/demo-accounts/provision` avec `{"organizationId":"<tenant-id>"}` et son jeton Bearer. L’opération crée ou réutilise les personnes, comptes, rôles à privilèges minimaux et affectations `learner`, `student`, `teacher` et `platform-admin`. Même `platform-admin` reste limité au tenant indiqué.

Les mots de passe temporaires sont générés côté serveur, stockés uniquement sous forme de hash et renvoyés en clair seulement lors de la création initiale dans `credentials`. Un nouvel appel est sans effet et renvoie `credentials: []`. Chaque compte impose le changement du mot de passe à la première connexion. Cette route est authentifiée et exclusivement réservée au rôle `tenant-admin`; elle ne constitue pas une valeur par défaut publique.

## Identité visuelle et signatures

- Le logo institutionnel est configuré par tenant dans **Identité & preuves**. Seuls PNG et JPEG cohérents avec leur contenu sont acceptés, jusqu’à 1 Mio et 4096×4096 pixels. Le remplacement et la suppression sont audités; les SVG actifs sont refusés.
- Une signature associe une image PNG/JPEG, une personne, une fonction et un objectif. Seuls les utilisateurs disposant de `credentials.write` peuvent l’activer ou la révoquer.
- La plateforme conserve l’identifiant et le SHA-256 de la signature utilisée dans l’instantané du titre. Il s’agit d’une marque visuelle traçable, **pas d’une signature électronique qualifiée**.

## Documents de preuve

**Rôles :** gestionnaire documentaire (`documents.write`) pour importer, vérificateur distinct (`documents.verify`) pour décider, titulaire ou lecteur autorisé (`documents.read`) pour télécharger. Le titulaire d’un simple droit d’import ne peut donc pas auto-valider sa preuve.

**Formats et limites :** PDF, PNG ou JPEG, 8 Mio maximum par fichier. Le MIME déclaré doit correspondre aux octets. Les PDF avec JavaScript, lancement automatique ou pièce jointe incorporée sont refusés. Le nom est normalisé, le SHA-256 est calculé, et les octets sont stockés dans SQLite ou PostgreSQL — jamais sur le disque éphémère de Render.

**Workflow :** sélectionner la personne et le type (reçu, bulletin, certificat, attestation, diplôme ou type extensible), téléverser, contrôler l’état `pending`, puis valider, rejeter avec motif ou marquer expiré. Les liens facultatifs vers inscription, paiement, résultat ou délivrance sont validés dans le même tenant. Le téléchargement est authentifié et vérifie le tenant avant de lire le blob.

## Profils personnels

Chaque compte accède à **Mon profil** pour gérer nom usuel, langue, pays, fuseau, contacts, adresse, bio, accessibilité, notifications et photo PNG/JPEG (2 Mio maximum). Un consentement explicite est requis avant de stocker un contact d’urgence. Le titulaire voit ses données privées; les réponses destinées à d’autres personnes masquent les contacts secondaires et les informations d’urgence.

Les prénom/nom officiels, date de naissance, identifiants, rôles et affectations ne sont pas auto-modifiables. `people.write` est requis pour les champs officiels; les rôles et affectations restent en lecture seule dans l’écran de profil afin d’empêcher toute auto-escalade.

## Parcours LMS et titres

Le modèle suit **cours → chapitres (modules techniques existants) → leçons → quiz**. Les positions sont positives et uniques dans leur parent. Une leçon requise non terminée verrouille les suivantes; un prérequis explicite peut renforcer cet ordre. Un quiz de leçon doit atteindre son seuil avant validation et respecte une limite de 1 à 20 tentatives. L’examen final reste verrouillé jusqu’à la fin de toutes les leçons requises.

Le serveur calcule les verrous et crée la progression; l’interface seule ne peut pas contourner ces règles. Les opérations administratives historiques sur la progression restent disponibles aux détenteurs de `lms.write` et sont auditées.

Un certificat, une attestation ou un diplôme ne peut être délivré via le parcours qu’après validation de toutes les exigences et de l’examen final configuré. Le titre reçoit un numéro unique, un document immuable, un instantané des signataires, une référence publique opaque et un statut révocable. Sans autorisation/accréditation active configurée, la mention reste **« émis par la plateforme, accréditation non vérifiée »**; elle ne constitue pas une reconnaissance officielle.
