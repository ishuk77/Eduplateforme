const app = document.querySelector('#app');
const state = {
  token: window.sessionStorage.getItem('eduplateforme.accessToken'),
  user: null,
  resources: new Map(),
  references: new Map()
};

const modules = [
  {
    id: 'organizations',
    path: '/organizations',
    label: 'Organisations',
    eyebrow: 'Structure',
    description: 'Gérez les établissements accessibles à votre compte.',
    resources: [{
      id: 'organizations', title: 'Établissements', path: '/organizations',
      read: 'organizations.read', write: 'organizations.write',
      fields: [
        ['legalName', 'Nom légal', 'text', true],
        ['displayName', 'Nom affiché', 'text', true],
        ['internalReference', 'Référence interne', 'text', true],
        ['countryCode', 'Code pays', 'text', true],
        ['organizationType', 'Type', 'text', false],
        ['nationalInstitutionId', 'Identifiant national', 'text', false],
        ['registrationNumber', 'Immatriculation', 'text', false],
        ['taxIdentifier', 'Identifiant fiscal', 'text', false],
        ['legalForm', 'Forme juridique', 'text', false],
        ['administrativeAuthority', 'Autorité administrative', 'text', false],
        ['operationalStatus', 'Statut opérationnel', 'text', false]
      ],
      columns: ['displayName', 'internalReference', 'nationalInstitutionId', 'registrationNumber', 'operationalStatus', 'status']
    }]
  },
  {
    id: 'institution',
    path: '/institution',
    label: 'Institution',
    eyebrow: 'Conformité',
    description: 'Gérez séparément sites, autorisations de fonctionnement, accréditations et vérification publique.',
    resources: [
      {
        id: 'campuses', title: 'Sites et campus', path: '/institution/campuses',
        read: 'institution.read', write: 'institution.write',
        fields: [['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['campusType', 'Type de site', 'text', false], ['localIdentifier', 'Identifiant local', 'text', false], ['timezone', 'Fuseau horaire', 'text', false]],
        columns: ['code', 'name', 'campusType', 'localIdentifier', 'status']
      },
      {
        id: 'operatingAuthorizations', title: 'Autorisations de fonctionnement', path: '/institution/operating-authorizations',
        read: 'institution.read', write: 'institution.write',
        fields: [['type', 'Type', 'text', true], ['authority', 'Autorité', 'text', true], ['jurisdiction', 'Juridiction', 'text', true], ['reference', 'Référence', 'text', true], ['validFrom', 'Valide du', 'date', false], ['validUntil', 'Valide au', 'date', false], ['evidenceReference', 'Preuve', 'text', false]],
        columns: ['type', 'authority', 'jurisdiction', 'reference', 'validUntil', 'status']
      },
      {
        id: 'accreditations', title: 'Accréditations', path: '/institution/accreditations',
        read: 'institution.read', write: 'institution.write',
        fields: [['accreditationType', 'Type', 'text', true], ['authority', 'Autorité', 'text', true], ['jurisdiction', 'Juridiction', 'text', true], ['targetType', 'Cible', 'select', true, ['institution', 'site', 'program', 'level', 'qualification']], ['targetId', 'Identifiant cible', 'text', true], ['reference', 'Référence', 'text', true], ['validUntil', 'Valide au', 'date', false]],
        columns: ['accreditationType', 'targetType', 'targetId', 'reference', 'status']
      },
      {
        id: 'institutionVerifications', title: 'Vérification institutionnelle', path: '/institution/verifications',
        read: 'institution.read', write: 'institution.verify',
        fields: [['publicCode', 'Code public', 'text', true], ['authority', 'Autorité', 'text', false], ['publicNote', 'Mention publique', 'textarea', false]],
        columns: ['publicCode', 'status', 'authority', 'verifiedAt', 'validUntil']
      }
    ]
  },
  {
    id: 'profiles',
    path: '/profiles',
    label: 'Profils métier',
    eyebrow: 'Responsabilités',
    description: 'Gérez les profils responsables et professionnels indépendamment des comptes de connexion.',
    resources: [
      {
        id: 'guardianProfiles', title: 'Parents et tuteurs', path: '/profiles/guardians',
        read: 'profiles.read', write: 'profiles.write',
        fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['relationshipTypes', 'Types de relation (JSON)', 'json', false], ['preferredContactChannels', 'Canaux préférés (JSON)', 'json', false]],
        columns: ['personId', 'relationshipTypes', 'preferredContactChannels', 'status']
      },
      {
        id: 'professionalProfiles', title: 'Enseignants et staff', path: '/profiles/professionals',
        read: 'profiles.read', write: 'profiles.write',
        fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['professionalType', 'Métier', 'select', true, ['teacher', 'professor', 'trainer', 'staff']], ['specialties', 'Spécialités (JSON)', 'json', false], ['qualifications', 'Qualifications (JSON)', 'json', false], ['assignmentOrganizationIds', 'Organisations autorisées (JSON)', 'json', false]],
        columns: ['personId', 'professionalType', 'specialties', 'qualifications', 'assignmentOrganizationIds', 'status']
      },
      {
        id: 'guardianLearnerRelations', title: 'Relations responsable-apprenant', path: '/profiles/guardian-relations',
        read: 'profiles.read', write: 'profiles.write',
        fields: [['guardianProfileId', 'Responsable', 'reference', true, '/profiles/guardians', 'personId'], ['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['relationship', 'Relation', 'text', true], ['permissions', 'Permissions (JSON)', 'json', false]],
        columns: ['guardianProfileId', 'learnerId', 'relationship', 'permissions', 'status']
      },
      {
        id: 'professionalAssignments', title: 'Affectations professionnelles', path: '/profiles/professional-assignments',
        read: 'profiles.read', write: 'profiles.write',
        fields: [['professionalProfileId', 'Profil', 'reference', true, '/profiles/professionals', 'personId'], ['campusId', 'Campus', 'reference', false, '/institution/campuses', 'name'], ['roleTitle', 'Fonction', 'text', true], ['employmentType', 'Contrat', 'text', false], ['startsOn', 'Début', 'date', true], ['endsOn', 'Fin', 'date', false]],
        columns: ['professionalProfileId', 'campusId', 'roleTitle', 'startsOn', 'endsOn', 'status']
      }
    ]
  },
  {
    id: 'people',
    path: '/people',
    label: 'Personnes',
    eyebrow: 'Identité',
    description: 'Créez et maintenez les profils des apprenants, équipes et responsables.',
    resources: [{
      id: 'people', title: 'Personnes', path: '/people',
      read: 'people.read', write: 'people.write',
      fields: [
        ['givenName', 'Prénom', 'text', true],
        ['familyName', 'Nom', 'text', true],
        ['preferredName', 'Nom usuel', 'text', false],
        ['birthDate', 'Date de naissance', 'date', false],
        ['preferredLocale', 'Langue', 'text', false]
      ],
      columns: ['givenName', 'familyName', 'preferredLocale', 'status']
    }]
  },
  {
    id: 'academics',
    path: '/academics',
    label: 'Scolarité',
    eyebrow: 'Académique',
    description: 'Construisez les années, programmes, classes, apprenants et inscriptions.',
    resources: [
      {
        id: 'years', title: 'Années scolaires', path: '/academics/years',
        read: 'academics.read', write: 'academics.write',
        fields: [['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['startsOn', 'Début', 'date', true], ['endsOn', 'Fin', 'date', true]],
        columns: ['code', 'name', 'startsOn', 'endsOn']
      },
      {
        id: 'programs', title: 'Programmes', path: '/academics/programs',
        read: 'academics.read', write: 'academics.write',
        fields: [['academicYearId', 'Année scolaire', 'reference', true, '/academics/years', 'name'], ['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['cycle', 'Cycle', 'text', false]],
        columns: ['code', 'name', 'cycle', 'status']
      },
      {
        id: 'classes', title: 'Classes', path: '/academics/classes',
        read: 'academics.read', write: 'academics.write',
        fields: [['academicYearId', 'Année scolaire', 'reference', true, '/academics/years', 'name'], ['programId', 'Programme', 'reference', true, '/academics/programs', 'name'], ['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['levelCode', 'Niveau', 'text', false]],
        columns: ['code', 'name', 'levelCode', 'status']
      },
      {
        id: 'learners', title: 'Apprenants', path: '/academics/learners',
        read: 'academics.read', write: 'academics.write',
        fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['learnerNumber', 'Matricule', 'text', false]],
        columns: ['learnerNumber', 'personId', 'status']
      },
      {
        id: 'enrollments', title: 'Inscriptions', path: '/academics/enrollments',
        read: 'academics.read', write: 'academics.write',
        fields: [
          ['personId', 'Personne', 'reference', true, '/people', 'familyName'],
          ['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'],
          ['classId', 'Classe', 'reference', true, '/academics/classes', 'name'],
          ['academicYearId', 'Année scolaire', 'reference', true, '/academics/years', 'name'],
          ['enrollmentReference', 'Référence', 'text', false]
        ],
        columns: ['enrollmentReference', 'personId', 'classId', 'status']
      },
      {
        id: 'academicPeriods', title: 'Périodes', path: '/academics/periods',
        read: 'academics.read', write: 'academics.write',
        fields: [['academicYearId', 'Année scolaire', 'reference', true, '/academics/years', 'name'], ['periodType', 'Type', 'select', true, ['semester', 'trimester']], ['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['startsOn', 'Début', 'date', true], ['endsOn', 'Fin', 'date', true]],
        columns: ['code', 'name', 'periodType', 'startsOn', 'endsOn']
      },
      {
        id: 'academicLevels', title: 'Niveaux et spécialités', path: '/academics/levels',
        read: 'academics.read', write: 'academics.write',
        fields: [['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['specialization', 'Spécialisation', 'text', false], ['creditsRequired', 'Crédits requis', 'number', false]],
        columns: ['code', 'name', 'specialization', 'creditsRequired']
      },
      {
        id: 'subjects', title: 'Matières', path: '/academics/subjects',
        read: 'academics.read', write: 'academics.write',
        fields: [['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['description', 'Description', 'textarea', false], ['defaultCredits', 'Crédits', 'number', false]],
        columns: ['code', 'name', 'defaultCredits', 'status']
      },
      {
        id: 'courses', title: 'Cours', path: '/academics/courses',
        read: 'academics.read', write: 'academics.write',
        fields: [['subjectId', 'Matière', 'reference', true, '/academics/subjects', 'name'], ['academicPeriodId', 'Période', 'reference', true, '/academics/periods', 'name'], ['classId', 'Classe', 'reference', false, '/academics/classes', 'name'], ['programId', 'Programme', 'reference', false, '/academics/programs', 'name'], ['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['teacherAssignmentIds', 'Affectations enseignantes (JSON)', 'json', false], ['credits', 'Crédits', 'number', false]],
        columns: ['code', 'name', 'subjectId', 'academicPeriodId', 'credits']
      },
      {
        id: 'learnerLifecycleEvents', title: 'Parcours longitudinal', path: '/academics/lifecycle-events',
        read: 'lifecycle.read', write: 'lifecycle.write',
        fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['eventType', 'Événement', 'select', true, ['admission', 'enrollment', 'promotion', 'repetition', 'class_change', 'program_change', 'suspension', 'resumption', 'withdrawal', 'expulsion', 'graduation', 'certification', 'death', 'archiving']], ['authority', 'Autorité', 'text', true], ['reason', 'Motif', 'textarea', false], ['evidenceReference', 'Preuve', 'text', false], ['previousContext', 'Ancien contexte (JSON)', 'json', false], ['newContext', 'Nouveau contexte (JSON)', 'json', false]],
        columns: ['occurredAt', 'learnerId', 'eventType', 'authority', 'reason'],
        createOnly: true
      }
    ]
  },
  {
    id: 'assignments',
    path: '/assignments',
    label: 'Devoirs',
    eyebrow: 'Travail scolaire',
    description: 'Publiez les devoirs, recevez les soumissions et notez-les sans quitter le suivi de classe.',
    resources: [
      {
        id: 'assignments', title: 'Devoirs', path: '/assignments',
        read: 'assignments.read', write: 'assignments.write',
        fields: [['classId', 'Classe', 'reference', true, '/academics/classes', 'name'], ['title', 'Titre', 'text', true], ['type', 'Type', 'select', true, ['homework', 'exercise', 'quiz', 'exam']], ['dueAt', 'Échéance', 'datetime-local', true]],
        columns: ['title', 'type', 'classId', 'dueAt']
      },
      {
        id: 'assignmentSubmissions', title: 'Soumissions', path: '/assignments/submissions',
        read: 'assignments.read', write: 'assignments.write',
        fields: [['assignmentId', 'Devoir', 'reference', true, '/assignments', 'title'], ['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['contentReference', 'Référence du travail', 'text', true]],
        columns: ['assignmentId', 'learnerId', 'submittedAt', 'score', 'maxScore'],
        action: { label: 'Noter', path: '/assignments/submissions/grade', idField: 'submissionId', fields: [['score', 'Note', 'number', true], ['maxScore', 'Barème', 'number', true], ['coefficient', 'Coefficient', 'number', true]] }
      }
    ]
  },
  {
    id: 'grading',
    path: '/grading',
    label: 'Notes',
    eyebrow: 'Évaluation',
    description: 'Configurez les barèmes, saisissez les notes et consultez la moyenne réelle des évaluations chargées.',
    resources: [
      {
        id: 'gradingSystems', title: 'Systèmes de notation', path: '/grading/systems',
        read: 'grading.read', write: 'grading.write',
        fields: [['name', 'Nom', 'text', true], ['format', 'Format', 'select', true, ['/10', '/20', '/100', 'A-F', 'competency']], ['passingThreshold', 'Seuil de réussite', 'number', false]],
        columns: ['name', 'format', 'passingThreshold']
      },
      {
        id: 'grades', title: 'Notes', path: '/grading/grades',
        read: 'grading.read', write: 'grading.write',
        fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['assignmentId', 'Devoir', 'reference', false, '/assignments', 'title'], ['score', 'Note', 'number', true], ['maxScore', 'Barème', 'number', true], ['coefficient', 'Coefficient', 'number', true]],
        columns: ['learnerId', 'assignmentId', 'score', 'maxScore', 'coefficient'],
        summary: (items) => {
          const latest = new Map();
          for (const item of items) {
            const key = `${item.learnerId}:${item.assignmentId ?? '__manual__'}`;
            if (!latest.has(key) || Number(item.version) > Number(latest.get(key).version)) latest.set(key, item);
          }
          const effective = [...latest.values()];
          const weight = effective.reduce((total, item) => total + Number(item.coefficient || 1), 0);
          const points = effective.reduce((total, item) => total + ((Number(item.score) / Number(item.maxScore || 20)) * 20 * Number(item.coefficient || 1)), 0);
          return `Moyenne pondérée : ${weight ? (points / weight).toFixed(2) : '0.00'} / 20`;
        }
      }
    ]
  },
  {
    id: 'attendance',
    path: '/attendance',
    label: 'Présences',
    eyebrow: 'Assiduité',
    description: 'Consignez la présence et suivez le taux d’assiduité calculé depuis les enregistrements réels.',
    resources: [{
      id: 'attendance', title: 'Registre de présence', path: '/attendance/records',
      read: 'attendance.read', write: 'attendance.write',
      fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['classId', 'Classe', 'reference', true, '/academics/classes', 'name'], ['date', 'Date', 'date', true], ['status', 'Statut', 'select', true, ['present', 'absent', 'late', 'excused', 'unexcused']]],
      columns: ['date', 'learnerId', 'classId', 'status'],
      summary: (items) => {
        const present = items.filter((item) => !['absent', 'unexcused'].includes(item.status)).length;
        return `Taux d’assiduité global : ${items.length ? ((present / items.length) * 100).toFixed(1) : '0.0'} %`;
      }
    }]
  },
  {
    id: 'scheduling',
    path: '/scheduling',
    label: 'Emplois du temps',
    eyebrow: 'Planification',
    description: 'Planifiez les créneaux de cours par classe, matière et enseignant.',
    resources: [{
      id: 'scheduleEntries', title: 'Créneaux', path: '/scheduling/entries',
      read: 'scheduling.read', write: 'scheduling.write',
      fields: [['classId', 'Classe', 'reference', true, '/academics/classes', 'name'], ['subject', 'Matière', 'text', true], ['teacherPersonId', 'Enseignant', 'reference', true, '/people', 'familyName'], ['dayOfWeek', 'Jour', 'select', true, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']], ['startsAt', 'Début', 'time', true], ['endsAt', 'Fin', 'time', true]],
      columns: ['dayOfWeek', 'startsAt', 'endsAt', 'subject', 'teacherPersonId']
    }]
  },
  {
    id: 'finance',
    path: '/finance',
    label: 'Finances',
    eyebrow: 'Facturation',
    description: 'Configurez les frais, émettez les factures et enregistrez les paiements avec solde à jour.',
    resources: [
      {
        id: 'fees', title: 'Types de frais', path: '/finance/fees', read: 'finance.read', write: 'finance.write',
        fields: [['feeType', 'Type de frais', 'text', true], ['amount', 'Montant', 'number', true], ['currency', 'Devise', 'select', true, ['USD', 'EUR', 'CDF', 'RWF', 'HTG', 'KES', 'UGX']]],
        columns: ['feeType', 'amount', 'currency']
      },
      {
        id: 'invoices', title: 'Factures et soldes', path: '/finance/invoices', read: 'finance.read', write: 'finance.write',
        fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['feeConfigurationId', 'Frais', 'reference', true, '/finance/fees', 'feeType'], ['amount', 'Montant', 'number', true], ['currency', 'Devise', 'select', true, ['USD', 'EUR', 'CDF', 'RWF', 'HTG', 'KES', 'UGX']]],
        columns: ['learnerId', 'amount', 'currency', 'balance']
      },
      {
        id: 'payments', title: 'Paiements', path: '/finance/payments', read: 'finance.read', write: 'finance.write',
        fields: [['invoiceId', 'Facture', 'reference', true, '/finance/invoices', 'id'], ['amount', 'Montant', 'number', true], ['currency', 'Devise', 'select', true, ['USD', 'EUR', 'CDF', 'RWF', 'HTG', 'KES', 'UGX']], ['channel', 'Canal', 'text', true]],
        columns: ['invoiceId', 'amount', 'currency', 'channel', 'receiptReference']
      }
    ]
  },
  {
    id: 'notifications',
    path: '/notifications',
    label: 'Notifications',
    eyebrow: 'Diffusion',
    description: 'Créez les notifications et confirmez explicitement leur envoi.',
    resources: [{
      id: 'notifications', title: 'Notifications', path: '/notifications',
      read: 'notifications.read', write: 'notifications.write',
      fields: [['eventType', 'Événement', 'text', true], ['channel', 'Canal', 'select', true, ['internal', 'email', 'sms', 'mobile']], ['recipientId', 'Destinataire', 'text', true]],
      columns: ['eventType', 'channel', 'recipientId', 'sentAt'],
      action: { label: 'Marquer envoyée', path: '/notifications/sent', idField: 'notificationId', fields: [], show: (record) => !record.sentAt }
    }]
  },
  {
    id: 'virtualSchools',
    path: '/virtual-schools',
    label: 'Académie virtuelle',
    eyebrow: 'Formation en ligne',
    description: 'Créez des académies virtuelles et leurs formations gratuites ou payantes.',
    resources: [
      {
        id: 'virtualSchools', title: 'Académies', path: '/virtual-schools', read: 'virtual-schools.read', write: 'virtual-schools.write',
        fields: [['name', 'Nom', 'text', true], ['timezone', 'Fuseau horaire', 'text', true]], columns: ['name', 'timezone']
      },
      {
        id: 'paidTrainings', title: 'Formations', path: '/virtual-schools/trainings', read: 'virtual-schools.read', write: 'virtual-schools.write',
        fields: [['virtualSchoolId', 'Académie', 'reference', true, '/virtual-schools', 'name'], ['title', 'Titre', 'text', true], ['pricingModel', 'Tarification', 'select', true, ['free', 'paid']], ['amount', 'Montant', 'number', true], ['currency', 'Devise', 'select', true, ['USD', 'EUR', 'CDF', 'RWF', 'HTG', 'KES', 'UGX']], ['platformCommissionRate', 'Commission (%)', 'number', true]],
        columns: ['title', 'pricingModel', 'amount', 'currency', 'platformCommissionRate']
      }
    ]
  },
  {
    id: 'certificates',
    path: '/certificates',
    label: 'Certificats',
    eyebrow: 'Attestations',
    description: 'Émettez des certificats vérifiables associés à un apprenant.',
    resources: [{
      id: 'certificates', title: 'Certificats', path: '/certificates', read: 'certificates.read', write: 'certificates.write',
      fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['certificateType', 'Type', 'text', true], ['title', 'Titre', 'text', true], ['verificationCode', 'Code de vérification', 'text', true]],
      columns: ['title', 'certificateType', 'learnerId', 'verificationCode', 'qrCode']
    }]
  },
  {
    id: 'i18n',
    path: '/i18n',
    label: 'Localisation',
    eyebrow: 'Profil régional',
    description: 'Définissez la langue, la devise, le fuseau et le format de date de l’organisation.',
    resources: [{
      id: 'localizationProfiles', title: 'Profil de localisation', path: '/i18n/profiles', read: 'i18n.read', write: 'i18n.write',
      fields: [['countryCode', 'Code pays', 'text', true], ['city', 'Ville', 'text', true], ['language', 'Langue', 'select', true, ['fr', 'en', 'es', 'pt', 'ar']], ['currency', 'Devise', 'select', true, ['USD', 'EUR', 'CDF', 'RWF', 'HTG', 'KES', 'UGX']], ['timezone', 'Fuseau horaire', 'text', true], ['dateFormat', 'Format de date', 'text', true]],
      columns: ['countryCode', 'city', 'language', 'currency', 'timezone', 'dateFormat'], createOnly: true, history: false
    }]
  },
  {
    id: 'parentalConsents',
    path: '/security/parental-consents',
    label: 'Consentements',
    eyebrow: 'Protection des mineurs',
    description: 'Enregistrez et consultez les consentements parentaux par apprenant et finalité.',
    resources: [{
      id: 'parentalConsents', title: 'Consentements parentaux', path: '/security/parental-consents', read: 'security.read', write: 'security.write',
      fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['parentPersonId', 'Responsable', 'reference', true, '/people', 'familyName'], ['scope', 'Finalité', 'text', true], ['grantedAt', 'Accord donné le', 'datetime-local', true]],
      columns: ['learnerId', 'parentPersonId', 'scope', 'grantedAt'], createOnly: true
    }]
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'Rapports',
    eyebrow: 'Résultats',
    description: 'Générez les bulletins à partir des données académiques réelles.',
    resources: [{
      id: 'reports', title: 'Bulletins', path: '/reports/cards',
      read: 'reports.read', write: 'reports.write',
      fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['period', 'Période', 'text', true], ['appreciation', 'Appréciation', 'textarea', false], ['decision', 'Décision', 'text', false]],
      columns: ['period', 'learnerId', 'average', 'absences', 'decision']
    }]
  },
  {
    id: 'communications',
    path: '/communications',
    label: 'Communications',
    eyebrow: 'Échanges',
    description: 'Organisez des fils de discussion et publiez des messages traçables.',
    resources: [
      {
        id: 'threads', title: 'Fils de discussion', path: '/communications/threads',
        read: 'communications.read', write: 'communications.write',
        fields: [['title', 'Titre', 'text', true], ['scope', 'Audience', 'text', true], ['moderationLevel', 'Modération', 'text', false]],
        columns: ['title', 'scope', 'moderationLevel', 'status']
      },
      {
        id: 'messages', title: 'Messages', path: '/communications/messages',
        read: 'communications.read', write: 'communications.write',
        fields: [['threadId', 'Fil', 'reference', true, '/communications/threads', 'title'], ['authorPersonId', 'Auteur', 'reference', true, '/people', 'familyName'], ['content', 'Message', 'textarea', true]],
        columns: ['content', 'threadId', 'authorPersonId', 'createdAt']
      }
    ]
  },
  {
    id: 'discipline',
    path: '/discipline',
    label: 'Discipline',
    eyebrow: 'Vie scolaire',
    description: 'Consignez les incidents, sanctions et récompenses dans le périmètre de l’école.',
    resources: [{
      id: 'discipline', title: 'Registre', path: '/discipline/records',
      read: 'discipline.read', write: 'discipline.write',
      fields: [['learnerId', 'Apprenant', 'reference', true, '/academics/learners', 'learnerNumber'], ['type', 'Type', 'text', true], ['description', 'Description', 'textarea', true], ['severity', 'Gravité', 'select', true, ['low', 'medium', 'high']]],
      columns: ['type', 'description', 'severity', 'learnerId']
    }]
  },
  {
    id: 'calendar',
    path: '/calendar',
    label: 'Calendrier',
    eyebrow: 'Planification',
    description: 'Planifiez cours, examens, réunions et congés.',
    resources: [{
      id: 'calendar', title: 'Événements', path: '/calendar/events',
      read: 'calendar.read', write: 'calendar.write',
      fields: [['title', 'Titre', 'text', true], ['eventType', 'Type', 'text', true], ['startsAt', 'Début', 'datetime-local', true], ['endsAt', 'Fin', 'datetime-local', true], ['roleScope', 'Audience', 'text', false]],
      columns: ['title', 'eventType', 'startsAt', 'endsAt', 'roleScope']
    }]
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    label: 'Abonnements',
    eyebrow: 'Offre',
    description: 'Consultez et administrez le plan de la plateforme pour l’établissement.',
    resources: [{
      id: 'subscriptions', title: 'Abonnements', path: '/subscriptions/platform',
      read: 'subscriptions.read', write: 'subscriptions.write',
      fields: [['plan', 'Plan', 'select', true, ['free', 'standard', 'premium', 'enterprise']], ['startsOn', 'Début', 'date', true], ['endsOn', 'Fin', 'date', false]],
      columns: ['plan', 'startsOn', 'endsOn', 'status']
    }]
  },
  {
    id: 'documents',
    path: '/documents',
    label: 'Documents',
    eyebrow: 'Justificatifs',
    description: 'Enregistrez des documents et émettez des justificatifs versionnés.',
    resources: [
      {
        id: 'documents', title: 'Documents', path: '/documents',
        read: 'documents.read', write: 'documents.write',
        fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['type', 'Type', 'text', true], ['title', 'Titre', 'text', true], ['storageReference', 'Référence de stockage', 'text', true], ['documentNumber', 'Numéro', 'text', false]],
        columns: ['title', 'type', 'documentNumber', 'versionNumber', 'status']
      },
      {
        id: 'credentials', title: 'Justificatifs', path: '/credentials',
        read: 'credentials.read', write: 'credentials.write',
        fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['documentId', 'Document', 'reference', true, '/documents', 'title'], ['credentialType', 'Type', 'text', true], ['credentialNumber', 'Numéro', 'text', false]],
        columns: ['credentialType', 'credentialNumber', 'versionNumber', 'status']
      }
    ]
  },
  {
    id: 'audit',
    path: '/audit',
    label: 'Audit',
    eyebrow: 'Gouvernance',
    description: 'Contrôlez les opérations enregistrées et leur contexte organisationnel.',
    resources: [{
      id: 'audit', title: 'Journal d’audit', path: '/audit/trail',
      read: 'audit.read', write: null, fields: [],
      columns: ['timestamp', 'action', 'entityType', 'entityId', 'actorId']
    }]
  }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return escapeHtml(JSON.stringify(value));
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) {
    return escapeHtml(new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)));
  }
  return escapeHtml(value);
}

function setToken(token) {
  state.token = token ?? null;
  if (state.token) window.sessionStorage.setItem('eduplateforme.accessToken', state.token);
  else window.sessionStorage.removeItem('eduplateforme.accessToken');
}

async function refreshSession() {
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  if (!response.ok) return false;
  const payload = await response.json();
  setToken(payload.accessToken);
  state.user = payload.user;
  return true;
}

async function apiRequest(path, options = {}, retry = true) {
  const headers = new Headers(options.headers ?? {});
  if (state.token) headers.set('authorization', `Bearer ${state.token}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  if (response.status === 401 && retry && await refreshSession()) {
    return apiRequest(path, options, false);
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `La requête a échoué (${response.status}).`);
  }
  return payload;
}

function can(permission) {
  return !permission || state.user?.permissions?.includes('*') || state.user?.permissions?.includes(permission);
}

function notification(message, type = 'success') {
  const region = document.querySelector('#feedback');
  if (!region) return;
  region.className = `feedback feedback--${type}`;
  region.textContent = message;
  region.hidden = false;
  region.focus();
}

function authForm(kind) {
  const registration = kind === 'register';
  return `
    <main class="public-layout">
      <a class="brand-mark public-brand" href="/">Eduplateforme</a>
      <section class="auth-card surface-card">
        <p class="section-label">${registration ? 'Créer un compte' : 'Bon retour'}</p>
        <h1>${registration ? 'Commencez avec votre école' : 'Connectez-vous'}</h1>
        <p class="section-copy">${registration ? 'Votre compte sera administrateur de l’établissement créé à l’étape suivante.' : 'Accédez aux données réelles de votre établissement.'}</p>
        <div id="feedback" class="feedback" role="alert" tabindex="-1" hidden></div>
        <form id="auth-form" class="form-grid">
          ${registration ? `
            <label>Prénom<input name="givenName" autocomplete="given-name" required></label>
            <label>Nom<input name="familyName" autocomplete="family-name" required></label>
          ` : ''}
          <label>${registration ? 'Identifiant' : 'Identifiant ou courriel'}<input name="username" autocomplete="username" minlength="${registration ? 3 : 1}" required></label>
          ${registration ? '<label>Courriel<input name="email" type="email" autocomplete="email" required></label>' : ''}
          <label>Mot de passe<input name="password" type="password" autocomplete="${registration ? 'new-password' : 'current-password'}" minlength="${registration ? 10 : 8}" required></label>
          <button class="primary-button" type="submit">${registration ? 'Créer mon compte' : 'Se connecter'}</button>
        </form>
        <p class="auth-switch">${registration ? 'Déjà inscrit ? <a href="/login">Se connecter</a>' : 'Première visite ? <a href="/register">Créer un compte</a>'}</p>
      </section>
    </main>`;
}

function landing() {
  return `
    <main class="landing">
      <header class="public-header">
        <a class="brand-mark" href="/">Eduplateforme</a>
        <nav aria-label="Accès au compte">
          <a class="secondary-button" href="/login">Connexion</a>
          <a class="primary-button" href="/register">Créer un compte</a>
        </nav>
      </header>
      <section class="landing-hero">
        <div>
          <p class="section-label">Gestion scolaire multi-établissement</p>
          <h1>Une école organisée, des données utiles, des actions traçables.</h1>
          <p>Eduplateforme réunit inscriptions, personnes, calendrier, communications, bulletins, documents et gouvernance dans un espace sécurisé.</p>
          <div class="hero-actions">
            <a class="primary-button" href="/register">Créer mon école</a>
            <a class="secondary-button" href="/login">J’ai déjà un compte</a>
            <a class="secondary-button" href="/verify-institution">Vérifier une institution</a>
          </div>
        </div>
        <div class="landing-panel surface-card">
          <p class="section-label">MVP testable</p>
          <h2>Du premier compte au pilotage quotidien</h2>
          <ul>
            <li>Onboarding guidé de l’établissement</li>
            <li>Données isolées par organisation</li>
            <li>Formulaires et listes reliés à l’API</li>
          </ul>
        </div>
      </section>
    </main>`;
}

function onboarding() {
  return `
    <main class="public-layout">
      <a class="brand-mark public-brand" href="/">Eduplateforme</a>
      <section class="auth-card surface-card">
        <p class="section-label">Dernière étape</p>
        <h1>Créez votre établissement</h1>
        <p class="section-copy">Ces informations définissent votre espace isolé. Vous en deviendrez administrateur.</p>
        <div id="feedback" class="feedback" role="alert" tabindex="-1" hidden></div>
        <form id="onboarding-form" class="form-grid">
          <label>Nom légal<input name="legalName" required minlength="2"></label>
          <label>Nom affiché<input name="displayName" required minlength="2"></label>
          <label>Référence interne<input name="internalReference" required minlength="2" placeholder="ECOLE-001"></label>
          <label>Code pays<input name="countryCode" required minlength="2" maxlength="2" value="FR"></label>
          <label>Type<select name="organizationType"><option value="institution">Établissement</option><option value="school">École</option><option value="campus">Campus</option></select></label>
          <button class="primary-button" type="submit">Créer l’établissement</button>
        </form>
      </section>
    </main>`;
}

function shell(content, activeId = 'dashboard') {
  const profile = state.user?.profile;
  return `
    <div class="app-shell">
      <aside class="shell-nav" id="shell-nav" data-open="false" aria-label="Navigation principale">
        <a class="brand-mark" href="/dashboard">Eduplateforme</a>
        <p class="tenant-name">${escapeHtml(profile ? `${profile.givenName} ${profile.familyName}` : state.user?.username)}</p>
        <nav class="nav-links">
          <a class="nav-link ${activeId === 'dashboard' ? 'is-active' : ''}" href="/dashboard"><span>Tableau de bord</span><small>Vue d’ensemble</small></a>
          ${modules.map((module) => `<a class="nav-link ${activeId === module.id ? 'is-active' : ''}" href="${module.path}"><span>${module.label}</span><small>${module.eyebrow}</small></a>`).join('')}
        </nav>
        <button id="logout" class="logout-button" type="button">Déconnexion</button>
      </aside>
      <button class="nav-backdrop" id="nav-backdrop" type="button" hidden aria-label="Fermer la navigation"></button>
      <div class="shell-main">
        <header class="topbar">
          <button class="menu-toggle" id="menu-toggle" type="button" aria-controls="shell-nav" aria-expanded="false">Menu</button>
          <span class="organization-chip">${escapeHtml(state.user?.organizationId ? 'Organisation active' : 'Configuration requise')}</span>
        </header>
        <div id="feedback" class="feedback global-feedback" role="alert" tabindex="-1" hidden></div>
        ${content}
      </div>
    </div>`;
}

function fieldInput(field, record = {}) {
  const [name, label, type, required, source, optionLabel] = field;
  const value = record[name] ?? '';
  if (type === 'reference') {
    const items = state.references.get(source)?.items ?? [];
    return `<label>${label}<select name="${name}" ${required ? 'required' : ''}><option value="">Sélectionner…</option>${items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === value ? 'selected' : ''}>${escapeHtml(item[optionLabel] || item.id)}</option>`).join('')}</select></label>`;
  }
  if (type === 'select') {
    return `<label>${label}<select name="${name}" ${required ? 'required' : ''}><option value="">Sélectionner…</option>${source.map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`;
  }
  if (type === 'textarea') {
    return `<label class="form-wide">${label}<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea></label>`;
  }
  if (type === 'json') {
    const serialized = value && typeof value === 'object' ? JSON.stringify(value) : value;
    return `<label class="form-wide">${label}<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(serialized)}</textarea></label>`;
  }
  let normalizedValue = value;
  if (type === 'datetime-local' && value) normalizedValue = String(value).slice(0, 16);
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(normalizedValue)}" ${required ? 'required' : ''}></label>`;
}

function resourceSection(resource) {
  const payload = state.resources.get(resource.id) ?? { items: [], page: { total: 0 } };
  const rows = payload.items.map((record) => `
    <article class="data-card" data-id="${escapeHtml(record.id)}">
      <dl>${resource.columns.map((column) => `<div><dt>${escapeHtml(column)}</dt><dd>${formatValue(record[column])}</dd></div>`).join('')}</dl>
      ${can(resource.write) && resource.action && (!resource.action.show || resource.action.show(record)) ? `
        <form class="inline-action-form" data-record-action="${resource.id}" data-id="${escapeHtml(record.id)}">
          ${resource.action.fields.map((field) => fieldInput(field)).join('')}
          <button class="secondary-button" type="submit">${resource.action.label}</button>
        </form>` : ''}
      ${resource.history !== false ? `<div class="row-actions"><button type="button" data-action="history" data-resource="${resource.id}" data-id="${escapeHtml(record.id)}">Historique</button>${can(resource.write) && !resource.createOnly ? `<button type="button" data-action="edit" data-resource="${resource.id}" data-id="${escapeHtml(record.id)}">Modifier</button><button class="danger-link" type="button" data-action="archive" data-resource="${resource.id}" data-id="${escapeHtml(record.id)}">Archiver</button>` : ''}</div><div class="record-history" aria-live="polite"></div>` : ''}
    </article>`).join('');
  return `
    <section class="surface-card resource-section" id="resource-${resource.id}">
      <div class="section-header"><div><p class="section-label">${payload.page.total} élément(s)</p><h2>${resource.title}</h2></div></div>
      ${resource.summary ? `<p class="resource-summary" role="status">${escapeHtml(resource.summary(payload.items))}</p>` : ''}
      ${can(resource.write) ? `
        <details class="editor-panel">
          <summary>Ajouter un élément</summary>
          <form class="form-grid resource-form" data-resource="${resource.id}">
            <input type="hidden" name="_recordId">
            ${resource.fields.map((field) => fieldInput(field)).join('')}
            <div class="form-actions form-wide"><button class="primary-button" type="submit">Enregistrer</button><button type="reset" class="secondary-button">Annuler</button></div>
          </form>
        </details>` : ''}
      <div class="data-grid">${rows || '<div class="empty-state"><h3>Aucune donnée</h3><p>Utilisez le formulaire ci-dessus pour créer le premier élément autorisé par l’API.</p></div>'}</div>
    </section>`;
}

async function loadReferences(module) {
  const paths = [...new Set(module.resources.flatMap((resource) => resource.fields.filter((field) => field[2] === 'reference').map((field) => field[4])))];
  await Promise.all(paths.map(async (path) => {
    if (state.references.has(path)) return;
    state.references.set(path, await apiRequest(`${path}?limit=200`));
  }));
}

async function modulePage(module) {
  app.innerHTML = shell(`<main class="content-stack"><section class="page-heading"><p class="section-label">${module.eyebrow}</p><h1>${module.label}</h1><p>${module.description}</p></section><section class="surface-card loading-card">Chargement des données…</section></main>`, module.id);
  bindShell();
  try {
    await loadReferences(module);
    await Promise.all(module.resources.map(async (resource) => {
      if (can(resource.read)) {
        state.resources.set(resource.id, await apiRequest(`${resource.path}?limit=100`));
      } else {
        state.resources.set(resource.id, { items: [], page: { total: 0 } });
      }
    }));
    app.innerHTML = shell(`<main class="content-stack"><section class="page-heading"><p class="section-label">${module.eyebrow}</p><h1>${module.label}</h1><p>${module.description}</p></section>${module.resources.map(resourceSection).join('')}</main>`, module.id);
    bindShell();
    bindResources(module);
  } catch (error) {
    notification(error.message, 'error');
  }
}

async function dashboard() {
  app.innerHTML = shell('<main class="content-stack"><section class="page-heading"><p class="section-label">Pilotage</p><h1>Tableau de bord</h1><p>Chargement des indicateurs de votre établissement…</p></section></main>');
  bindShell();
  const indicators = [
    ['Personnes', '/people', 'people.read', '/people'],
    ['Apprenants', '/academics/learners', 'academics.read', '/academics'],
    ['Inscriptions', '/academics/enrollments', 'academics.read', '/academics'],
    ['Événements', '/calendar/events', 'calendar.read', '/calendar'],
    ['Documents', '/documents', 'documents.read', '/documents'],
    ['Messages', '/communications/messages', 'communications.read', '/communications']
  ];
  try {
    const values = await Promise.all(indicators.map(async ([label, path, permission, link]) => {
      if (!can(permission)) return [label, null, link];
      const payload = await apiRequest(`${path}?limit=1`);
      return [label, payload.page.total, link];
    }));
    app.innerHTML = shell(`
      <main class="content-stack">
        <section class="page-heading"><p class="section-label">Pilotage</p><h1>Tableau de bord</h1><p>Les compteurs proviennent directement des API de votre organisation.</p></section>
        <section class="metric-grid">${values.map(([label, value, link]) => `<a class="metric-card surface-card" href="${link}"><span>${label}</span><strong>${value ?? '—'}</strong><small>${value === 0 ? 'Commencer' : 'Voir les données'}</small></a>`).join('')}</section>
        <section class="surface-card quick-start"><h2>Parcours conseillé</h2><p>Ajoutez d’abord des personnes, puis une année scolaire, un programme, une classe et une inscription.</p><a class="primary-button" href="/academics">Configurer la scolarité</a></section>
      </main>`);
    bindShell();
  } catch (error) {
    notification(error.message, 'error');
  }
}

function bindShell() {
  const navigation = document.querySelector('#shell-nav');
  const toggle = document.querySelector('#menu-toggle');
  const backdrop = document.querySelector('#nav-backdrop');
  const setOpen = (open) => {
    navigation?.setAttribute('data-open', String(open));
    toggle?.setAttribute('aria-expanded', String(open));
    if (backdrop) backdrop.hidden = !open;
  };
  toggle?.addEventListener('click', () => setOpen(navigation?.getAttribute('data-open') !== 'true'));
  backdrop?.addEventListener('click', () => setOpen(false));
  document.querySelector('#logout')?.addEventListener('click', async () => {
    try {
      await apiRequest('/auth/logout', { method: 'DELETE', body: '{}' });
    } catch {
      // Local session is cleared even if the server-side token already expired.
    }
    setToken(null);
    state.user = null;
    window.location.assign('/');
  });
}

function bindResources(module) {
  const byId = new Map(module.resources.map((resource) => [resource.id, resource]));
  document.querySelectorAll('.resource-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const resource = byId.get(form.dataset.resource);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Enregistrement…';
      try {
        const formData = new FormData(form);
        const recordId = formData.get('_recordId');
        const body = Object.fromEntries(resource.fields.map(([name, , type]) => {
          const value = formData.get(name);
          if (type === 'json' && value) return [name, JSON.parse(value)];
          if (type === 'number' && value !== '') return [name, Number(value)];
          return [name, value];
        }).filter(([, value]) => value !== ''));
        if (resource.id !== 'organizations') body.organizationId = state.user.organizationId;
        await apiRequest(recordId ? `${resource.path}/${recordId}` : resource.path, {
          method: recordId ? 'PUT' : 'POST',
          body: JSON.stringify(body)
        });
        notification(recordId ? 'Modification enregistrée.' : 'Élément créé.');
        await modulePage(module);
      } catch (error) {
        notification(error.message, 'error');
        button.disabled = false;
        button.textContent = 'Enregistrer';
      }
    });
  });
  document.querySelectorAll('.inline-action-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const resource = byId.get(form.dataset.recordAction);
      const body = Object.fromEntries(new FormData(form));
      body[resource.action.idField] = form.dataset.id;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await apiRequest(resource.action.path, { method: 'POST', body: JSON.stringify(body) });
        notification(`${resource.action.label} : opération enregistrée.`);
        await modulePage(module);
      } catch (error) {
        notification(error.message, 'error');
        button.disabled = false;
      }
    });
  });
  document.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const resource = byId.get(button.dataset.resource);
      const record = state.resources.get(resource.id).items.find((item) => item.id === button.dataset.id);
      const section = document.querySelector(`#resource-${resource.id}`);
      const details = section.querySelector('details');
      const form = section.querySelector('form');
      details.open = true;
      form.elements._recordId.value = record.id;
      for (const [name] of resource.fields) {
        if (form.elements[name]) form.elements[name].value = record[name] ?? '';
      }
      details.querySelector('summary').textContent = 'Modifier l’élément';
      form.querySelector('button[type="submit"]').textContent = 'Enregistrer les modifications';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.querySelectorAll('[data-action="history"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const resource = byId.get(button.dataset.resource);
      const region = button.closest('.data-card').querySelector('.record-history');
      button.disabled = true;
      region.textContent = 'Chargement de l’historique…';
      try {
        const history = await apiRequest(`${resource.path}/${button.dataset.id}/history`);
        region.innerHTML = history.items.length
          ? `<ul>${history.items.map((entry) => `<li><strong>${formatValue(entry.action)}</strong> · ${formatValue(entry.changedAt)}</li>`).join('')}</ul>`
          : '<p>Aucune modification enregistrée.</p>';
      } catch (error) {
        region.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });
  document.querySelectorAll('[data-action="archive"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const resource = byId.get(button.dataset.resource);
      button.disabled = true;
      try {
        await apiRequest(`${resource.path}/${button.dataset.id}`, { method: 'DELETE' });
        notification('Élément archivé.');
        await modulePage(module);
      } catch (error) {
        notification(error.message, 'error');
        button.disabled = false;
      }
    });
  });
}

async function loadCurrentUser() {
  if (!state.token && !await refreshSession()) return false;
  try {
    state.user = await apiRequest('/auth/me');
    return true;
  } catch {
    setToken(null);
    state.user = null;
    return false;
  }
}

async function route() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const publicPath = path === '/' || path === '/login' || path === '/register' || path === '/verify-institution';
  const authenticationEntryPath = path === '/' || path === '/login' || path === '/register';
  const authenticated = await loadCurrentUser();

  if (authenticated && state.user.organizationIds.length === 0 && path !== '/onboarding') {
    window.location.replace('/onboarding');
    return;
  }
  if (authenticated && state.user.organizationIds.length > 0 && (authenticationEntryPath || path === '/onboarding')) {
    window.location.replace('/dashboard');
    return;
  }
  if (!authenticated && !publicPath) {
    window.location.replace('/login');
    return;
  }

  if (path === '/') {
    app.innerHTML = landing();
    return;
  }
  if (path === '/verify-institution') {
    app.innerHTML = `
      <main class="public-layout">
        <a class="brand-mark public-brand" href="/">Eduplateforme</a>
        <section class="auth-card surface-card">
          <p class="section-label">Registre public</p>
          <h1>Vérifier une institution</h1>
          <p class="section-copy">Saisissez le code public fourni par l’établissement. Aucune donnée administrative privée n’est affichée.</p>
          <div id="feedback" class="feedback" role="alert" tabindex="-1" hidden></div>
          <form id="verification-form" class="form-grid">
            <label class="form-wide">Code public<input name="code" required autocomplete="off"></label>
            <button class="primary-button" type="submit">Vérifier</button>
          </form>
          <section id="verification-result" class="verification-result" aria-live="polite"></section>
        </section>
      </main>`;
    document.querySelector('#verification-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = new FormData(event.currentTarget).get('code');
      try {
        const result = await apiRequest(`/public/institutions/verify/${encodeURIComponent(code)}`);
        document.querySelector('#verification-result').innerHTML = `
          <h2>${escapeHtml(result.institution.displayName)}</h2>
          <dl>
            <div><dt>Statut</dt><dd>${escapeHtml(result.status)}</dd></div>
            <div><dt>Nom légal</dt><dd>${escapeHtml(result.institution.legalName)}</dd></div>
            <div><dt>Pays</dt><dd>${escapeHtml(result.institution.countryCode)}</dd></div>
            <div><dt>Autorité</dt><dd>${formatValue(result.authority)}</dd></div>
          </dl>`;
      } catch (error) {
        notification(error.message, 'error');
      }
    });
    return;
  }
  if (path === '/login' || path === '/register') {
    const kind = path.slice(1);
    app.innerHTML = authForm(kind);
    document.querySelector('#auth-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = Object.fromEntries(new FormData(form));
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Chargement…';
      try {
        const payload = await apiRequest(`/auth/${kind}`, { method: 'POST', body: JSON.stringify(body) }, false);
        setToken(payload.accessToken);
        state.user = payload.user;
        window.location.assign(kind === 'register' ? '/onboarding' : '/dashboard');
      } catch (error) {
        notification(error.message, 'error');
        button.disabled = false;
        button.textContent = kind === 'register' ? 'Créer mon compte' : 'Se connecter';
      }
    });
    return;
  }
  if (path === '/onboarding') {
    app.innerHTML = onboarding();
    document.querySelector('#onboarding-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Création…';
      try {
        const payload = await apiRequest('/auth/onboarding', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        setToken(payload.accessToken);
        state.user = payload.user;
        window.location.assign('/dashboard');
      } catch (error) {
        notification(error.message, 'error');
        button.disabled = false;
        button.textContent = 'Créer l’établissement';
      }
    });
    return;
  }
  if (path === '/dashboard') {
    await dashboard();
    return;
  }
  const module = modules.find((candidate) => candidate.path === path);
  if (module) {
    await modulePage(module);
  }
}

await route();
