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

La page **Imports CSV/XLSX** fournit une bibliothèque de modèles individuels CSV et XLSX ainsi qu’un pack global XLSX. Les modèles complets utilisent exclusivement des identifiants lisibles et stables : `external_id` pour les personnes, matricules pour les apprenants et `code` pour les sites et le catalogue académique. Aucun UUID Eduplateforme n’est demandé.

### Ordre recommandé

1. `references`, `campuses`, `academic-years`, `academic-levels` et `subjects`;
2. `people`;
3. `learners`, `guardians` et `professionals`;
4. `academic-periods` et `programs`;
5. `classes`;
6. `guardian-links` et `professional-assignments`;
7. `courses`;
8. `enrollments`.

Chaque carte précise son objectif, ses dépendances et ses colonnes. Le classeur individuel contient **Instructions**, **Données**, **Dictionnaire** et, lorsqu’il existe des choix fermés, **Références**. La ligne d’en-tête est figée, filtrable et ne doit être ni renommée ni réordonnée.

### Contrats complets

| Modèle | Colonnes exactes |
|---|---|
| `references` | `catalog,code,label_fr,label_en,label_es,label_pt,label_ar,country_code` |
| `campuses` | `code,name,campus_type,timezone,local_identifier` |
| `people` | `external_id,given_name,family_name,email,phone,birth_date,preferred_locale,country_of_citizenship` |
| `learners` | `person_external_id,learner_number,national_learner_id` |
| `guardians` | `person_external_id,relationship_types,preferred_contact_channels` |
| `guardian-links` | `guardian_person_external_id,learner_person_external_id,relationship,permissions` |
| `professionals` | `person_external_id,professional_type,specialties,qualifications` |
| `professional-assignments` | `professional_person_external_id,campus_code,role_title,employment_type,starts_on,ends_on` |
| `academic-years` | `code,name,starts_on,ends_on,calendar_system` |
| `academic-periods` | `code,name,academic_year_code,period_type,sequence,starts_on,ends_on` |
| `academic-levels` | `code,name,specialization,credits_required` |
| `programs` | `code,name,academic_year_code,cycle,national_program_code` |
| `classes` | `code,name,academic_year_code,program_code,level_code,campus_code` |
| `subjects` | `code,name,description,default_credits` |
| `courses` | `code,name,subject_code,academic_period_code,class_code,program_code,credits` |
| `enrollments` | `learner_person_external_id,class_code,enrollment_reference,status` |

Les champs multivalués utilisent `|` comme séparateur interne. Les dates utilisent `AAAA-MM-JJ`. Les codes et `external_id` doivent rester identiques entre fichiers. Les exemples fournis sont fictifs, internationaux et ne doivent pas être remplacés par des données réelles avant que le fichier ne soit stocké conformément aux règles de l’établissement.

### Validation et application

Les CSV sont en UTF-8 avec BOM et séparateur virgule. Un XLSX importé doit conserver la feuille **Données**. Le serveur contrôle l’extension et la signature, les en-têtes exacts, les champs obligatoires, formats, listes, doublons, références externes et appartenance au tenant. Toute formule CSV ou XLSX est refusée, y compris sur une autre feuille du classeur.

Limites : 5 Mio, 1 000 lignes, 20 colonnes, 8 feuilles et 20 000 cellules. Le fichier n’est pas écrit sur disque. Le dry-run ne modifie aucune donnée et retourne les erreurs avec ligne et champ. L’application confirmée est tout-ou-rien, idempotente et transactionnelle sous SQLite/PostgreSQL; son rapport distingue `created`, `updated`, `ignored` et `invalid`.

Les anciens modèles unifiés restent accessibles sans paramètre `format` sur leurs URL historiques; `class-roster` et `staff` restent acceptés pour compatibilité. Ils peuvent créer des comptes temporaires selon leur contrat historique; les nouveaux modèles complets ne créent jamais implicitement de compte de connexion.

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
