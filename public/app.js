const app = document.querySelector('#app');
const state = {
  token: window.sessionStorage.getItem('eduplateforme.accessToken'),
  user: null,
  locale: window.localStorage.getItem('eduplateforme.locale')
    ?? (navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr'),
  resources: new Map(),
  references: new Map(),
  offlineQueue: JSON.parse(window.localStorage.getItem('eduplateforme.offlineQueue') ?? '[]')
};

const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'pt', 'ar'];
const COUNTRY_CODES = ['BE', 'BR', 'CA', 'CD', 'CI', 'CM', 'DZ', 'ES', 'FR', 'GB', 'GH', 'GN', 'HT', 'KE', 'MA', 'ML', 'MX', 'NG', 'PT', 'RW', 'SN', 'TN', 'UG', 'US'];
if (!SUPPORTED_LOCALES.includes(state.locale)) state.locale = 'fr';

const translations = {
  en: {
    dashboard: ['Dashboard', 'Overview'],
    lms: ['LMS', 'Learning'],
    meetings: ['Video conferencing', 'Integrations'],
    dataQuality: ['Data quality', 'Data Quality Center'],
    emis: ['EMIS', 'Interoperability'],
    references: ['Reference data', 'Standards'],
    logout: 'Sign out',
    activeOrganization: 'Active organization',
    loading: 'Loading data…',
    add: 'Add an item',
    empty: 'No data',
    emptyHint: 'Use the form above to create the first API-backed item.',
    noResults: 'No result has been recorded yet.'
  },
  fr: {
    logout: 'Déconnexion',
    activeOrganization: 'Organisation active',
    loading: 'Chargement des données…',
    add: 'Ajouter un élément',
    empty: 'Aucune donnée',
    emptyHint: 'Utilisez le formulaire ci-dessus pour créer le premier élément autorisé par l’API.',
    noResults: 'Aucun résultat enregistré pour le moment.'
  },
  es: {
    logout: 'Cerrar sesión', activeOrganization: 'Organización activa', loading: 'Cargando datos…',
    add: 'Añadir', empty: 'Sin datos', emptyHint: 'Cree primero los requisitos indicados.',
    noResults: 'Todavía no hay resultados.'
  },
  pt: {
    logout: 'Sair', activeOrganization: 'Organização ativa', loading: 'A carregar dados…',
    add: 'Adicionar', empty: 'Sem dados', emptyHint: 'Crie primeiro os pré-requisitos indicados.',
    noResults: 'Ainda não há resultados.'
  },
  ar: {
    logout: 'تسجيل الخروج', activeOrganization: 'المؤسسة النشطة', loading: 'جارٍ تحميل البيانات…',
    add: 'إضافة', empty: 'لا توجد بيانات', emptyHint: 'أنشئ المتطلبات الأساسية أولاً.',
    noResults: 'لا توجد نتائج حتى الآن.'
  }
};

function t(key) {
  return translations[state.locale]?.[key] ?? translations.fr[key] ?? key;
}

function moduleLabel(module, part = 0) {
  return translations[state.locale]?.[module.id]?.[part]
    ?? (part === 0 ? module.label : module.eyebrow);
}

function applyLocale() {
  document.documentElement.lang = state.locale;
  document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr';
}

function countryFlag(countryCode) {
  const code = String(countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((character) => 127397 + character.charCodeAt(0)));
}

function countryName(countryCode) {
  const code = String(countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return code || '—';
  try {
    return new Intl.DisplayNames([state.locale, 'fr'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

function countryIndicator(countryCode) {
  const code = String(countryCode ?? '').toUpperCase();
  return `${countryFlag(code)} ${countryName(code)} (${code || '—'})`;
}

function countryOptions(selected = '') {
  return COUNTRY_CODES.map((code) =>
    `<option value="${code}" ${code === String(selected).toUpperCase() ? 'selected' : ''}>${escapeHtml(countryIndicator(code))}</option>`
  ).join('');
}

applyLocale();

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
      columns: ['displayName', 'countryCode', 'internalReference', 'nationalInstitutionId', 'registrationNumber', 'operationalStatus', 'status']
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
    }, {
      id: 'consents', title: 'Consentements et confidentialité', path: '/security/consents', read: 'consents.read', write: 'consents.write',
      fields: [['subjectPersonId', 'Personne concernée', 'reference', true, '/people', 'familyName'], ['authorityPersonId', 'Autorité du consentement', 'reference', true, '/people', 'familyName'], ['subjectCapacity', 'Capacité', 'select', true, ['minor', 'adult']], ['purpose', 'Finalité', 'text', true], ['dataScope', 'Données concernées (JSON)', 'json', true], ['recipientOrganizationId', 'Organisation destinataire', 'text', true], ['legalBasis', 'Base juridique', 'text', true], ['expiresAt', 'Expiration', 'datetime-local', true]],
      columns: ['subjectPersonId', 'subjectCapacity', 'purpose', 'dataScope', 'recipientOrganizationId', 'expiresAt', 'status'],
      createOnly: true,
      action: { label: 'Retirer', path: '/security/consents/:id/withdraw', fields: [['reason', 'Motif', 'text', true]], show: (record) => record.status === 'active' }
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
    id: 'lms',
    path: '/lms',
    label: 'LMS',
    eyebrow: 'Apprentissage',
    description: 'Construisez des parcours liés au cursus, suivez la progression et rattachez paiements et justificatifs.',
    resources: [
      { id: 'lmsCatalogs', title: 'Catalogues', path: '/lms/catalogs', read: 'lms.read', write: 'lms.write', fields: [['code', 'Code', 'text', true], ['name', 'Nom', 'text', true], ['description', 'Description', 'textarea', false]], columns: ['code', 'name', 'status'] },
      { id: 'lmsPrograms', title: 'Programmes LMS', path: '/lms/programs', read: 'lms.read', write: 'lms.write', fields: [['catalogId', 'Catalogue', 'reference', true, '/lms/catalogs', 'name'], ['academicProgramId', 'Programme académique', 'reference', true, '/academics/programs', 'name'], ['code', 'Code', 'text', true], ['title', 'Titre', 'text', true]], columns: ['code', 'title', 'catalogId', 'academicProgramId'] },
      { id: 'lmsCourses', title: 'Cours LMS', path: '/lms/courses', read: 'lms.read', write: 'lms.write', fields: [['programId', 'Programme LMS', 'reference', true, '/lms/programs', 'title'], ['academicCourseId', 'Cours académique', 'reference', true, '/academics/courses', 'name'], ['code', 'Code', 'text', true], ['title', 'Titre', 'text', true], ['position', 'Position', 'number', false]], columns: ['code', 'title', 'position', 'programId'] },
      { id: 'lmsModules', title: 'Chapitres', path: '/lms/modules', read: 'lms.read', write: 'lms.write', fields: [['courseId', 'Cours LMS', 'reference', true, '/lms/courses', 'title'], ['title', 'Titre', 'text', true], ['position', 'Position', 'number', true], ['required', 'Obligatoire', 'checkbox', false]], columns: ['position', 'title', 'courseId', 'required'] },
      { id: 'lmsLessons', title: 'Leçons', path: '/lms/lessons', read: 'lms.read', write: 'lms.write', fields: [['moduleId', 'Chapitre', 'reference', true, '/lms/modules', 'title'], ['title', 'Titre', 'text', true], ['position', 'Position', 'number', true], ['prerequisiteLessonId', 'Prérequis explicite', 'reference', false, '/lms/lessons', 'title'], ['required', 'Obligatoire', 'checkbox', false]], columns: ['position', 'title', 'moduleId', 'required'] },
      { id: 'lmsResources', title: 'Ressources externes', path: '/lms/resources', read: 'lms.read', write: 'lms.write', fields: [['lessonId', 'Leçon', 'reference', true, '/lms/lessons', 'title'], ['title', 'Titre', 'text', true], ['externalReference', 'Référence externe', 'text', true], ['mediaType', 'Type MIME', 'text', false]], columns: ['title', 'externalReference', 'mediaType'] },
      { id: 'lmsParticipants', title: 'Participants', path: '/lms/participants', read: 'lms.read', write: 'lms.write', fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['role', 'Rôle', 'select', true, ['learner', 'teacher', 'facilitator', 'observer']]], columns: ['personId', 'role', 'status'] },
      { id: 'lmsEnrollments', title: 'Inscriptions LMS', path: '/lms/enrollments', read: 'lms.read', write: 'lms.write', fields: [['participantId', 'Participant', 'reference', true, '/lms/participants', 'personId'], ['programId', 'Programme LMS', 'reference', true, '/lms/programs', 'title']], columns: ['participantId', 'programId', 'enrollmentStatus'] },
      { id: 'lmsProgress', title: 'Progression', path: '/lms/progress', read: 'lms.read', write: 'lms.write', fields: [['enrollmentId', 'Inscription LMS', 'reference', true, '/lms/enrollments', 'id'], ['lessonId', 'Leçon', 'reference', true, '/lms/lessons', 'title'], ['percent', 'Progression (%)', 'number', true]], columns: ['enrollmentId', 'lessonId', 'percent', 'completedAt'] },
      { id: 'lmsQuizzes', title: 'Quiz et examen final', path: '/lms/quizzes', read: 'lms.read', write: 'lms.write', fields: [['courseId', 'Cours LMS', 'reference', true, '/lms/courses', 'title'], ['lessonId', 'Leçon (vide pour examen final)', 'reference', false, '/lms/lessons', 'title'], ['title', 'Titre', 'text', true], ['examType', 'Type', 'select', true, ['practice', 'lesson', 'final']], ['passingScore', 'Seuil (%)', 'number', true], ['maxAttempts', 'Tentatives maximum', 'number', true], ['attemptState', 'État des tentatives', 'select', true, ['open', 'closed']], ['required', 'Obligatoire', 'checkbox', false]], columns: ['title', 'courseId', 'lessonId', 'examType', 'passingScore', 'maxAttempts', 'attemptState'], action: { label: 'Soumettre une tentative', path: '/lms/quizzes/:id/attempts', fields: [['enrollmentId', 'Inscription LMS', 'reference', true, '/lms/enrollments', 'id'], ['answers', 'Réponses par question (JSON)', 'json', true]] } },
      { id: 'lmsQuestions', title: 'Questions', path: '/lms/questions', read: 'lms.read', write: 'lms.write', fields: [['quizId', 'Quiz', 'reference', true, '/lms/quizzes', 'title'], ['prompt', 'Question', 'textarea', true], ['questionType', 'Type', 'select', true, ['single', 'multiple', 'text']], ['options', 'Choix (JSON)', 'json', false], ['correctAnswer', 'Réponse attendue (JSON ou texte JSON)', 'json', true]], columns: ['quizId', 'prompt', 'questionType'] },
      { id: 'lmsAttempts', title: 'Tentatives', path: '/lms/attempts', read: 'lms.read', write: 'lms.write', create: false, createOnly: true, fields: [], columns: ['quizId', 'enrollmentId', 'score', 'passed', 'submittedAt'] },
      { id: 'lmsAssessments', title: 'Examens et évaluations', path: '/lms/assessments', read: 'lms.read', write: 'lms.write', fields: [['courseId', 'Cours LMS', 'reference', true, '/lms/courses', 'title'], ['title', 'Titre', 'text', true], ['assessmentType', 'Type', 'select', true, ['exam', 'evaluation', 'project']], ['gradingSystemId', 'Barème', 'reference', false, '/grading/systems', 'name']], columns: ['title', 'assessmentType', 'courseId'] },
      { id: 'lmsPayments', title: 'Paiements liés', path: '/lms/payments', read: 'lms.read', write: 'lms.write', fields: [['enrollmentId', 'Inscription LMS', 'reference', true, '/lms/enrollments', 'id'], ['invoiceId', 'Facture', 'reference', true, '/finance/invoices', 'id'], ['paymentId', 'Paiement', 'reference', false, '/finance/payments', 'receiptReference']], columns: ['enrollmentId', 'invoiceId', 'paymentId'] },
      { id: 'lmsCertificates', title: 'Credentials de complétion', path: '/lms/certificates', read: 'lms.read', write: 'lms.write', fields: [['enrollmentId', 'Inscription LMS', 'reference', true, '/lms/enrollments', 'id'], ['credentialId', 'Credential', 'reference', true, '/credentials', 'credentialNumber'], ['certificateId', 'Certificat', 'reference', false, '/certificates', 'verificationCode']], columns: ['enrollmentId', 'credentialId', 'certificateId'] }
    ]
  },
  {
    id: 'meetings',
    path: '/meetings',
    label: 'Visioconférence',
    eyebrow: 'Intégrations',
    description: 'Réunions fournies par un service externe, avec permissions et états explicites.',
    resources: [
      { id: 'meetingProviders', title: 'Fournisseurs', path: '/meetings/providers', read: 'meetings.read', write: 'meetings.write', fields: [['code', 'Code', 'text', true], ['providerType', 'Type', 'text', true], ['adapterKey', 'Adaptateur serveur', 'text', false], ['configuration', 'Configuration non secrète (JSON)', 'json', false]], columns: ['code', 'providerType', 'adapterKey', 'status'] },
      { id: 'meetings', title: 'Réunions', path: '/meetings', read: 'meetings.read', write: 'meetings.write', fields: [['providerId', 'Fournisseur', 'reference', true, '/meetings/providers', 'code'], ['externalMeetingId', 'ID externe', 'text', true], ['externalUrl', 'URL externe', 'url', true], ['startsAt', 'Date et heure', 'datetime-local', true], ['timezone', 'Fuseau', 'text', true]], columns: ['externalMeetingId', 'startsAt', 'timezone', 'externalState', 'attendanceState'], action: { label: 'Importer la présence', path: '/meetings/:id/attendance/import', fields: [] } },
      { id: 'meetingParticipants', title: 'Participants et permissions', path: '/meetings/participants', read: 'meetings.read', write: 'meetings.write', fields: [['meetingId', 'Réunion', 'reference', true, '/meetings', 'externalMeetingId'], ['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['role', 'Rôle', 'select', true, ['host', 'presenter', 'attendee']], ['canJoin', 'Peut rejoindre', 'checkbox', false], ['permissions', 'Permissions (JSON)', 'json', false]], columns: ['meetingId', 'personId', 'role', 'canJoin'] }
    ]
  },
  {
    id: 'dataQuality',
    path: '/data-quality',
    label: 'Qualité des données',
    eyebrow: 'Data Quality Center',
    description: 'Configurez des contrôles tenant/pays et suivez leur correction et validation.',
    resources: [
      { id: 'dataQualityRules', title: 'Règles', path: '/data-quality/rules', read: 'data-quality.read', write: 'data-quality.write', fields: [['code', 'Code', 'text', true], ['countryCode', 'Pays', 'text', false], ['dimension', 'Dimension', 'select', true, ['completeness', 'accuracy', 'validity', 'consistency', 'duplicates', 'references', 'timeliness', 'identifiers']], ['targetResource', 'Ressource', 'text', true], ['field', 'Champ', 'text', true], ['operator', 'Opérateur', 'select', true, ['required', 'unique', 'iso-country', 'pattern', 'reference', 'not-future', 'equals-field']], ['parameters', 'Paramètres (JSON)', 'json', false], ['weight', 'Poids', 'number', true]], columns: ['code', 'dimension', 'targetResource', 'field', 'operator', 'weight'] },
      { id: 'dataQualityRuns', title: 'Exécutions et scores', path: '/data-quality/runs', createPath: '/data-quality/runs/execute', read: 'data-quality.read', write: 'data-quality.write', fields: [['countryCode', 'Pays', 'text', false], ['targetResource', 'Ressource ciblée', 'text', false]], columns: ['startedAt', 'targetResource', 'runState', 'checked', 'score'], createOnly: true },
      { id: 'dataQualityIssues', title: 'Problèmes', path: '/data-quality/issues', read: 'data-quality.read', write: 'data-quality.write', create: false, createOnly: true, fields: [], columns: ['dimension', 'targetResource', 'targetId', 'field', 'issueState'], action: { label: (record) => record.issueState === 'corrected' ? 'Valider' : 'Corriger', path: (record) => `/data-quality/issues/${record.id}/${record.issueState === 'corrected' ? 'validate' : 'correct'}`, fields: [['correction', 'Correction (JSON)', 'json', false]], show: (record) => ['open', 'corrected'].includes(record.issueState) } }
    ]
  },
  {
    id: 'emis',
    path: '/emis',
    label: 'EMIS',
    eyebrow: 'Interopérabilité',
    description: 'Adaptez les mappings à chaque pays et conservez les tentatives de transmission.',
    resources: [
      { id: 'emisProfiles', title: 'Profils et connecteurs', path: '/emis/profiles', read: 'emis.read', write: 'emis.write', fields: [['code', 'Code', 'text', true], ['countryCode', 'Pays', 'text', true], ['adapterKey', 'Adaptateur serveur', 'text', false], ['direction', 'Direction', 'select', true, ['import', 'export', 'bidirectional']], ['configuration', 'Configuration non secrète (JSON)', 'json', false]], columns: ['code', 'countryCode', 'direction', 'adapterKey'] },
      { id: 'emisMappings', title: 'Mappings', path: '/emis/mappings', read: 'emis.read', write: 'emis.write', fields: [['profileId', 'Profil', 'reference', true, '/emis/profiles', 'code'], ['sourceField', 'Champ source', 'text', true], ['targetField', 'Champ cible', 'text', true], ['valueMapping', 'Mapping valeurs (JSON)', 'json', false]], columns: ['profileId', 'sourceField', 'targetField', 'valueMapping'] },
      { id: 'emisNationalReferences', title: 'Référentiels nationaux', path: '/emis/national-references', read: 'emis.read', write: 'emis.write', fields: [['profileId', 'Profil', 'reference', true, '/emis/profiles', 'code'], ['catalog', 'Catalogue', 'text', true], ['code', 'Code', 'text', true], ['label', 'Libellé', 'text', true]], columns: ['catalog', 'code', 'label'] },
      { id: 'emisExchanges', title: 'Imports et exports', path: '/emis/exchanges', read: 'emis.read', write: 'emis.write', fields: [['profileId', 'Profil', 'reference', true, '/emis/profiles', 'code'], ['direction', 'Direction', 'select', true, ['import', 'export']], ['payload', 'Payload structuré (JSON)', 'json', false], ['fileReference', 'Référence fichier', 'text', false]], columns: ['direction', 'exchangeState', 'externalReference', 'validationErrors', 'updatedAt'], action: { label: (record) => ['validation_failed', 'rejected'].includes(record.exchangeState) ? 'Corriger' : ['transport_error', 'pending_external'].includes(record.exchangeState) ? 'Réémettre' : 'Transmettre', path: (record) => `/emis/exchanges/${record.id}/${['validation_failed', 'rejected'].includes(record.exchangeState) ? 'correct' : ['transport_error', 'pending_external'].includes(record.exchangeState) ? 'retransmit' : 'transmit'}`, fields: [['payload', 'Payload corrigé (JSON)', 'json', false], ['fileReference', 'Référence fichier corrigée', 'text', false]], show: (record) => !['sent', 'acknowledged'].includes(record.exchangeState) } }
    ]
  },
  {
    id: 'references',
    path: '/references',
    label: 'Référentiels',
    eyebrow: 'Standards',
    description: 'Étendez les catalogues ISO, ISCED et nationaux sans coder de règle pays.',
    resources: [{ id: 'referenceEntries', title: 'Extensions tenant', path: '/references/entries', read: 'references.read', write: 'references.write', fields: [['catalog', 'Catalogue', 'text', true], ['code', 'Code', 'text', true], ['labels', 'Libellés FR/EN (JSON)', 'json', true], ['countryCode', 'Pays', 'text', false]], columns: ['catalog', 'code', 'labels', 'countryCode', 'standard'] }]
  },
  {
    id: 'documents',
    path: '/documents',
    label: 'Documents et mobilité',
    eyebrow: 'Dossiers de confiance',
    description: 'Gérez modèles, dossiers, justificatifs, partages contrôlés et transferts interinstitutionnels.',
    resources: [
      {
        id: 'documentTemplates', title: 'Modèles officiels', path: '/document-templates',
        read: 'documents.read', write: 'documents.write',
        fields: [['name', 'Nom', 'text', true], ['documentType', 'Type documentaire', 'text', true], ['versionNumber', 'Version', 'number', true], ['schema', 'Schéma (JSON)', 'json', true], ['layoutReference', 'Référence de mise en page', 'text', false], ['requiredSignerFunctions', 'Fonctions signataires (JSON)', 'json', false]],
        columns: ['name', 'documentType', 'versionNumber', 'publishedAt', 'status']
      },
      {
        id: 'documents', title: 'Documents', path: '/documents',
        read: 'documents.read', write: 'documents.write',
        fields: [['personId', 'Personne', 'reference', true, '/people', 'familyName'], ['type', 'Type', 'text', true], ['title', 'Titre', 'text', true], ['storageReference', 'Référence sécurisée', 'text', true], ['documentNumber', 'Numéro', 'text', false], ['metadata', 'Métadonnées (JSON)', 'json', false], ['accessLevel', 'Accès', 'select', true, ['restricted', 'holder', 'organization', 'shared']], ['accessPolicy', 'Politique d’accès (JSON)', 'json', false], ['expiresAt', 'Expiration', 'datetime-local', false]],
        columns: ['title', 'type', 'documentNumber', 'versionNumber', 'accessLevel', 'expiresAt', 'status'],
        action: { label: 'Changer le statut', path: '/documents/:id/transition', fields: [['status', 'Nouveau statut', 'select', true, ['expired', 'archived']], ['reason', 'Motif', 'text', true]] }
      },
      {
        id: 'credentials', title: 'Diplômes et attestations', path: '/credentials',
        read: 'credentials.read', write: 'credentials.write',
        fields: [['personId', 'Titulaire', 'reference', true, '/people', 'familyName'], ['documentId', 'Document', 'reference', true, '/documents', 'title'], ['templateId', 'Modèle', 'reference', false, '/document-templates', 'name'], ['credentialType', 'Type', 'select', true, ['diploma', 'certificate', 'attestation', 'credential']], ['credentialNumber', 'Numéro unique', 'text', false], ['qualification', 'Qualification', 'text', true], ['programId', 'Programme', 'reference', false, '/academics/programs', 'name'], ['signatories', 'Signataires et signatures (JSON)', 'json', false], ['sealReference', 'Référence du sceau', 'text', false], ['expiresAt', 'Expiration', 'datetime-local', false]],
        columns: ['credentialType', 'credentialNumber', 'qualification', 'versionNumber', 'publicReference', 'status'],
        createOnly: true,
        action: { label: 'Appliquer la transition', path: '/credentials/:id/transition', fields: [['status', 'Nouveau statut', 'select', true, ['issued', 'valid', 'suspended', 'revoked', 'void', 'expired', 'replaced']], ['reason', 'Motif', 'text', true], ['authority', 'Autorité', 'text', false]] }
      },
      {
        id: 'documentShares', title: 'Partages contrôlés', path: '/document-shares',
        read: 'documents.read', write: 'documents.write',
        fields: [['documentId', 'Document', 'reference', true, '/documents', 'title'], ['recipient', 'Destinataire', 'text', true], ['purpose', 'Finalité', 'text', true], ['dataScope', 'Données autorisées (JSON)', 'json', true], ['consentId', 'Consentement', 'reference', false, '/security/consents', 'purpose'], ['expiresAt', 'Expiration', 'datetime-local', true]],
        columns: ['documentId', 'recipient', 'purpose', 'dataScope', 'expiresAt', 'status'],
        createOnly: true,
        action: { label: 'Fermer le partage', path: '/document-shares/:id/revoke', fields: [['status', 'Décision', 'select', true, ['revoked', 'refused']], ['reason', 'Motif', 'text', true]] }
      },
      {
        id: 'collaborationRequests', title: 'Demandes interinstitutionnelles', path: '/collaboration/requests',
        read: 'collaboration.read', write: 'collaboration.write',
        fields: [['destinationOrganizationId', 'Organisation destinataire', 'text', true], ['requestType', 'Type', 'select', true, ['verification', 'transfer', 'record', 'confirmation', 'recommendation', 'sharing']], ['purpose', 'Finalité', 'text', true], ['dataScope', 'Périmètre (JSON)', 'json', true], ['expiresAt', 'Expiration', 'datetime-local', true]],
        columns: ['requestType', 'destinationOrganizationId', 'purpose', 'dataScope', 'expiresAt', 'status'],
        createOnly: true,
        action: { label: 'Répondre', path: '/collaboration/requests/:id/decision', fields: [['status', 'Décision', 'select', true, ['accepted', 'refused', 'partial']], ['acceptedDataScope', 'Périmètre accepté (JSON)', 'json', false], ['reason', 'Motif', 'text', true]] }
      },
      {
        id: 'transfers', title: 'Transferts sécurisés', path: '/transfers',
        read: 'transfers.read', write: 'transfers.write',
        fields: [['destinationOrganizationId', 'Organisation destinataire', 'text', true], ['learnerId', 'Apprenant source', 'reference', true, '/academics/learners', 'learnerNumber'], ['requestedData', 'Données demandées (JSON)', 'json', true], ['authorizationBasis', 'Base d’autorisation', 'select', true, ['consent', 'legal-obligation', 'public-task']], ['consentId', 'Consentement', 'reference', false, '/security/consents', 'purpose'], ['securePayloadReference', 'Référence sécurisée', 'text', true], ['encryption', 'Chiffrement (JSON)', 'json', false], ['destinationClassId', 'Classe destination', 'text', false], ['destinationAcademicYearId', 'Année destination', 'text', false]],
        columns: ['learnerId', 'sourceOrganizationId', 'destinationOrganizationId', 'authorizationBasis', 'status', 'destinationEnrollmentId'],
        createOnly: true,
        action: { label: 'Faire progresser', path: '/transfers/:id/transition', fields: [['status', 'Étape', 'select', true, ['requested', 'validated', 'sent', 'acknowledged', 'refused', 'cancelled', 'expired']], ['reason', 'Motif', 'text', true]] }
      }
    ]
  },
  {
    id: 'analytics',
    path: '/analytics',
    label: 'Analytics',
    eyebrow: 'Pilotage confidentiel',
    description: 'Configurez les méthodes de calcul et seuils de confidentialité des indicateurs.',
    resources: [{
      id: 'analyticsConfigurations', title: 'Configurations analytiques', path: '/analytics/configurations',
      read: 'analytics.read', write: 'analytics.write',
      fields: [['privacyMinimum', 'Taille minimale de cohorte', 'number', true], ['calculationMethods', 'Méthodes de calcul (JSON)', 'json', false], ['allowedDimensions', 'Dimensions autorisées (JSON)', 'json', false]],
      columns: ['privacyMinimum', 'calculationMethods', 'allowedDimensions', 'updatedAt']
    }]
  },
  {
    id: 'support',
    path: '/support',
    label: 'Aide & support',
    eyebrow: 'Centre de service',
    description: 'FAQ, guides et tickets suivis de L1 à L4 avec historique.',
    resources: [{
      id: 'supportTickets', title: 'Tickets', path: '/support/tickets',
      read: 'support.read', write: 'support.write',
      fields: [['subject', 'Sujet', 'text', true], ['description', 'Description', 'textarea', true], ['priority', 'Priorité', 'select', true, ['low', 'normal', 'high', 'urgent']], ['supportLevel', 'Niveau', 'select', true, ['L1', 'L2', 'L3', 'L4']], ['ticketState', 'Statut', 'select', true, ['open', 'in_progress', 'waiting', 'resolved', 'closed']]],
      columns: ['subject', 'priority', 'supportLevel', 'ticketState', 'comments', 'updatedAt'],
      action: { label: 'Ajouter un commentaire', path: '/support/tickets/:id/comments', fields: [['message', 'Commentaire', 'text', true], ['ticketState', 'Statut', 'select', false, ['open', 'in_progress', 'waiting', 'resolved', 'closed']], ['supportLevel', 'Niveau', 'select', false, ['L1', 'L2', 'L3', 'L4']]] }
    }]
  },
  {
    id: 'saas',
    path: '/saas',
    label: 'Plans & quotas',
    eyebrow: 'SaaS',
    description: 'Gérez les fonctionnalités, quotas, essais, renouvellements et suspensions sans simuler de facturation.',
    resources: [
      { id: 'saasPlans', title: 'Plans', path: '/saas/plans', read: 'saas.read', write: 'saas.write', fields: [['code', 'Code', 'text', true], ['features', 'Fonctionnalités (JSON)', 'json', true], ['userQuota', 'Quota utilisateurs', 'number', true], ['storageQuotaBytes', 'Quota stockage (octets)', 'number', true]], columns: ['code', 'features', 'userQuota', 'storageQuotaBytes'] },
      { id: 'tenantSubscriptions', title: 'Abonnements tenant', path: '/saas/subscriptions', read: 'saas.read', write: 'saas.write', fields: [['planId', 'Plan', 'reference', true, '/saas/plans', 'code'], ['subscriptionState', 'Statut', 'select', true, ['trial', 'active', 'renewal_due', 'suspended', 'ended']], ['trialEndsAt', 'Fin essai', 'datetime-local', false], ['renewsAt', 'Renouvellement', 'datetime-local', false]], columns: ['planId', 'subscriptionState', 'trialEndsAt', 'renewsAt'] }
    ]
  },
  {
    id: 'operations',
    path: '/operations',
    label: 'Exploitation',
    eyebrow: 'Résilience',
    description: 'Suivez sauvegardes, restauration, intégrité, RPO/RTO et incidents réels.',
    resources: [
      { id: 'backupConfigurations', title: 'Configuration sauvegarde/PRA', path: '/operations/backup-configurations', read: 'operations.read', write: 'operations.write', fields: [['providerKey', 'Fournisseur configuré côté serveur', 'text', false], ['schedule', 'Planification', 'text', true], ['retentionDays', 'Rétention (jours)', 'number', true], ['rpoHours', 'RPO (heures)', 'number', true], ['rtoHours', 'RTO (heures)', 'number', true]], columns: ['providerKey', 'schedule', 'retentionDays', 'rpoHours', 'rtoHours', 'updatedAt'] },
      { id: 'backupOperations', title: 'Registre sauvegarde/PRA', path: '/operations/backups', createPath: '/operations/backups/request', read: 'operations.read', write: 'operations.write', fields: [['operationType', 'Opération', 'select', true, ['backup', 'restore', 'integrity_test']], ['rpoHours', 'RPO (heures)', 'number', true], ['rtoHours', 'RTO (heures)', 'number', true]], columns: ['operationType', 'operationState', 'integrityState', 'rpoHours', 'rtoHours', 'updatedAt'] },
      { id: 'incidents', title: 'Incidents', path: '/operations/incidents', read: 'operations.read', write: 'operations.write', fields: [['title', 'Titre', 'text', true], ['severity', 'Sévérité', 'select', true, ['low', 'medium', 'high', 'critical']], ['incidentState', 'Statut', 'select', true, ['open', 'monitoring', 'resolved']], ['publicMessage', 'Message de service', 'textarea', false]], columns: ['title', 'severity', 'incidentState', 'publicMessage', 'updatedAt'] }
    ]
  },
  {
    id: 'ai',
    path: '/ai',
    label: 'Assistance IA',
    eyebrow: 'Humain responsable',
    description: 'Demandes assistives consenties, désactivées sans fournisseur et sans décision autonome à fort impact.',
    resources: [{
      id: 'aiAssistanceRequests', title: 'Demandes', path: '/ai/requests',
      createPath: '/ai/assist', read: 'ai-assistance.read', write: 'ai-assistance.write',
      fields: [['requestedAction', 'Type d’assistance', 'select', true, ['summarize', 'translate', 'draft', 'explain']], ['prompt', 'Demande', 'textarea', true], ['consent', 'Consentement explicite', 'checkbox', true]],
      columns: ['requestedAction', 'assistanceState', 'providerConfigured', 'decisionAuthority', 'updatedAt']
    }]
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
    return escapeHtml(new Intl.DateTimeFormat(state.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)));
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

async function apiUpload(path, formData) {
  if (!navigator.onLine) throw new Error('Une connexion est requise pour téléverser un document officiel.');
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: state.token ? { authorization: ['Bearer', state.token].join(' ') } : {},
    body: formData
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? `Téléversement impossible (${response.status}).`);
  return payload;
}

async function downloadAuthenticated(path, fileName) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { authorization: ['Bearer', state.token].join(' ') }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `Téléchargement impossible (${response.status}).`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function openAuthenticatedHtml(path, targetWindow) {
  if (!targetWindow) throw new Error('Autorisez les fenêtres contextuelles pour ouvrir le titre.');
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { authorization: ['Bearer', state.token].join(' ') }
  });
  if (!response.ok) throw new Error(`Vue imprimable impossible (${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
  targetWindow.location.assign(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function loadSecureImages() {
  await Promise.all([...document.querySelectorAll('[data-secure-image]')].map(async (image) => {
    const response = await fetch(image.dataset.secureImage, {
      credentials: 'same-origin',
      headers: { authorization: ['Bearer', state.token].join(' ') }
    });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    image.src = url;
    image.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  }));
}

function persistOfflineQueue() {
  window.localStorage.setItem('eduplateforme.offlineQueue', JSON.stringify(state.offlineQueue));
}

function queueOfflineMutation(resource, action, entityId, payload, expectedUpdatedAt = null) {
  if (!['supportTickets', 'lmsProgress'].includes(resource)) return false;
  state.offlineQueue.push({
    idempotencyKey: crypto.randomUUID(),
    resource,
    action,
    entityId,
    payload,
    expectedUpdatedAt
  });
  persistOfflineQueue();
  return true;
}

async function synchronizeOfflineQueue() {
  if (!navigator.onLine || !state.token || !state.user?.organizationId || state.offlineQueue.length === 0) return;
  const pending = [...state.offlineQueue];
  const result = await apiRequest('/offline/synchronize', {
    method: 'POST',
    body: JSON.stringify({ organizationId: state.user.organizationId, mutations: pending })
  });
  const retained = new Set(
    result.results.filter((item) => ['conflict', 'requires_online_confirmation'].includes(item.state))
      .map((item) => item.idempotencyKey)
  );
  state.offlineQueue = pending.filter((item) => retained.has(item.idempotencyKey));
  persistOfflineQueue();
}

async function downloadAnalytics(format) {
  const query = new URLSearchParams(window.location.search);
  query.set('format', format);
  const request = () => fetch(`/analytics/export?${query}`, {
    credentials: 'same-origin',
    headers: { authorization: ['Bearer', state.token].join(' ') }
  });
  let response = await request();
  if (response.status === 401 && await refreshSession()) response = await request();
  if (!response.ok) throw new Error(`Export impossible (${response.status}).`);
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `analytics.${format}`;
  link.click();
  URL.revokeObjectURL(blobUrl);
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
    <main class="public-layout" id="main-content">
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
    <main class="landing" id="main-content">
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
            <a class="secondary-button" href="/verify-credential">Vérifier un diplôme</a>
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
    <main class="public-layout" id="main-content">
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
          <label>Pays<select name="countryCode" required>${countryOptions('FR')}</select></label>
          <label>Langue de l’espace<select name="locale">${SUPPORTED_LOCALES.map((locale) => `<option value="${locale}" ${state.locale === locale ? 'selected' : ''}>${locale.toUpperCase()}</option>`).join('')}</select></label>
          <label>Type<select name="organizationType"><option value="institution">Établissement</option><option value="school">École</option><option value="university">Université</option><option value="training-center">Centre de formation</option><option value="campus">Campus</option></select></label>
          <label>Identifiant national<input name="nationalInstitutionId"></label>
          <label>Immatriculation<input name="registrationNumber"></label>
          <label>Identifiant fiscal<input name="taxIdentifier"></label>
          <label>Forme juridique<input name="legalForm"></label>
          <label>Autorité administrative<input name="administrativeAuthority"></label>
          <label>Statut opérationnel<select name="operationalStatus"><option value="pending">En attente</option><option value="operational">Opérationnel</option><option value="suspended">Suspendu</option></select></label>
          <label class="form-wide">Adresse du siège (JSON)<textarea name="headquartersAddress" placeholder='{"city":"Dakar"}'></textarea></label>
          <label class="form-wide">Contact officiel (JSON)<textarea name="officialContact" placeholder='{"email":"contact@example.edu"}'></textarea></label>
          <button class="primary-button" type="submit">Créer l’établissement</button>
        </form>
      </section>
    </main>`;
}

function shell(content, activeId = 'dashboard') {
  const profile = state.user?.profile;
  const navigationGroups = [
    { label: 'Configuration', ids: ['organizations', 'institution', 'i18n', 'references', 'academics', 'people', 'profiles'] },
    { label: 'Opérations quotidiennes', ids: ['scheduling', 'assignments', 'attendance', 'grading', 'lms', 'virtualSchools', 'finance', 'communications', 'notifications', 'documents', 'reports', 'certificates', 'calendar', 'discipline', 'parentalConsents'] },
    { label: 'Gouvernance & exploitation', ids: ['analytics', 'dataQuality', 'emis', 'meetings', 'saas', 'operations', 'ai', 'audit', 'support'] }
  ];
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const navigation = navigationGroups.map((group) => {
    const links = group.ids.map((id) => moduleById.get(id))
      .filter((module) => module?.resources.some((resource) => can(resource.read)));
    if (links.length === 0) return '';
    return `<section class="nav-group"><h2>${group.label}</h2>${links.map((module) => `<a class="nav-link ${activeId === module.id ? 'is-active' : ''}" href="${module.path}"><span>${moduleLabel(module)}</span><small>${moduleLabel(module, 1)}</small></a>`).join('')}</section>`;
  }).join('');
  const organization = state.user?.organization;
  return `
    <div class="app-shell">
      <aside class="shell-nav" id="shell-nav" data-open="false" aria-label="Navigation principale">
        <a class="brand-mark" href="/dashboard">${organization ? `<img class="tenant-logo" src="/public/organizations/${encodeURIComponent(organization.id)}/logo" alt="Logo de ${escapeHtml(organization.displayName)}">` : ''}<span>Eduplateforme</span></a>
        <p class="tenant-name">${escapeHtml(profile ? `${profile.givenName} ${profile.familyName}` : state.user?.username)}</p>
        <nav class="nav-links">
          <a class="nav-link ${activeId === 'dashboard' ? 'is-active' : ''}" href="/dashboard"><span>${moduleLabel({ id: 'dashboard', label: 'Tableau de bord', eyebrow: 'Vue d’ensemble' })}</span><small>${moduleLabel({ id: 'dashboard', label: 'Tableau de bord', eyebrow: 'Vue d’ensemble' }, 1)}</small></a>
          ${navigation}
          <a class="nav-link ${activeId === 'myProfile' ? 'is-active' : ''}" href="/profile"><span>Mon profil</span><small>Préférences et confidentialité</small></a>
          ${can('organizations.write') || can('credentials.write') || can('documents.write') ? `<a class="nav-link ${activeId === 'identityAssets' ? 'is-active' : ''}" href="/identity-assets"><span>Identité & preuves</span><small>Logo, signatures, justificatifs</small></a>` : ''}
          ${can('lms.read') ? `<a class="nav-link ${activeId === 'learningPath' ? 'is-active' : ''}" href="/learning-path"><span>Mon parcours</span><small>Leçons, verrous et titres</small></a>` : ''}
          ${can('academics.write') && can('people.write') && can('accounts.write') ? `<a class="nav-link ${activeId === 'imports' ? 'is-active' : ''}" href="/imports"><span>Imports CSV/XLSX</span><small>Inscriptions et équipes</small></a>` : ''}
          <a class="nav-link ${activeId === 'help' ? 'is-active' : ''}" href="/help"><span>Guide des modules</span><small>Aide contextuelle</small></a>
        </nav>
        <button id="logout" class="logout-button" type="button">${t('logout')}</button>
      </aside>
      <button class="nav-backdrop" id="nav-backdrop" type="button" hidden aria-label="Fermer la navigation"></button>
      <div class="shell-main">
        <header class="topbar">
          <button class="menu-toggle" id="menu-toggle" type="button" aria-controls="shell-nav" aria-expanded="false">Menu</button>
          <label><span class="sr-only">Language</span><select id="locale-switch" aria-label="Language">${SUPPORTED_LOCALES.map((locale) => `<option value="${locale}" ${state.locale === locale ? 'selected' : ''}>${locale.toUpperCase()}</option>`).join('')}</select></label>
          <span id="sync-status" class="sync-status" role="status">${navigator.onLine ? 'En ligne' : 'Hors ligne'} · ${state.offlineQueue.length} en attente</span>
          <span class="organization-chip">${organization ? `${escapeHtml(countryFlag(organization.countryCode))} ${escapeHtml(organization.displayName || t('activeOrganization'))} · ${escapeHtml(organization.countryCode)}` : 'Configuration requise'}</span>
        </header>
        <div id="feedback" class="feedback global-feedback" role="alert" tabindex="-1" hidden></div>
        ${content}
      </div>
    </div>`;
}

function fieldInput(field, record = {}) {
  const [name, label, type, required, source, optionLabel] = field;
  const value = record[name] ?? '';
  if (name === 'countryCode') {
    return `<label>${label}<select name="${name}" ${required ? 'required' : ''}><option value="">Sélectionner…</option>${countryOptions(value)}</select></label>`;
  }
  if (name === 'preferredLocale' || name === 'language') {
    return `<label>${label}<select name="${name}" ${required ? 'required' : ''}><option value="">Sélectionner…</option>${SUPPORTED_LOCALES.map((locale) => `<option value="${locale}" ${locale === value ? 'selected' : ''}>${locale.toUpperCase()}</option>`).join('')}</select></label>`;
  }
  if (type === 'reference') {
    const reference = state.references.get(source);
    const items = reference?.items ?? [];
    const prerequisitePath = source.startsWith('/academics/') ? '/academics'
      : source.startsWith('/profiles/') ? '/profiles'
        : source.startsWith('/institution/') ? '/institution'
          : source.startsWith('/finance/') ? '/finance'
            : source.startsWith('/lms/') ? '/lms'
              : source;
    const status = reference?.error
      ? `Erreur de chargement. <a href="${prerequisitePath}">Réessayer dans le module source</a>.`
      : items.length === 0
        ? `Aucune option autorisée. <a href="${prerequisitePath}">Créer le prérequis</a>.`
        : `${items.length} option(s) disponible(s).`;
    return `<label>${label}<select name="${name}" ${required ? 'required' : ''} ${items.length === 0 ? 'disabled' : ''}><option value="">${reference?.error ? 'Erreur de chargement' : items.length === 0 ? 'Aucune option disponible' : 'Sélectionner…'}</option>${items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === value ? 'selected' : ''}>${escapeHtml(item[optionLabel] || item.id || 'Sans libellé')}</option>`).join('')}</select><small class="field-status" role="status">${status}</small></label>`;
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
  if (type === 'checkbox') {
    return `<label>${label}<input name="${name}" type="checkbox" ${value ? 'checked' : ''}></label>`;
  }
  let normalizedValue = value;
  if (type === 'datetime-local' && value) normalizedValue = String(value).slice(0, 16);
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(normalizedValue)}" ${required ? 'required' : ''}></label>`;
}

function resourceSection(resource) {
  const payload = state.resources.get(resource.id) ?? { items: [], page: { total: 0 } };
  const rows = payload.items.map((record) => `
    <article class="data-card" data-id="${escapeHtml(record.id)}">
      <dl>${resource.columns.map((column) => `<div><dt>${escapeHtml(column)}</dt><dd>${column === 'countryCode' ? escapeHtml(countryIndicator(record[column])) : formatValue(record[column])}</dd></div>`).join('')}</dl>
      ${can(resource.write) && resource.action && (!resource.action.show || resource.action.show(record)) ? `
        <form class="inline-action-form" data-record-action="${resource.id}" data-id="${escapeHtml(record.id)}">
          ${resource.action.fields.map((field) => fieldInput(field)).join('')}
          <button class="secondary-button" type="submit">${typeof resource.action.label === 'function' ? resource.action.label(record) : resource.action.label}</button>
        </form>` : ''}
      ${resource.history !== false ? `<div class="row-actions"><button type="button" data-action="history" data-resource="${resource.id}" data-id="${escapeHtml(record.id)}">Historique</button>${can(resource.write) && !resource.createOnly ? `<button type="button" data-action="edit" data-resource="${resource.id}" data-id="${escapeHtml(record.id)}">Modifier</button><button class="danger-link" type="button" data-action="archive" data-resource="${resource.id}" data-id="${escapeHtml(record.id)}">Archiver</button>` : ''}${resource.id === 'classes' && can('academics.write') && can('people.write') && can('accounts.write') ? `<a class="secondary-button" href="/imports?kind=class-roster&classId=${encodeURIComponent(record.id)}">Importer la liste</a>` : ''}</div><div class="record-history" aria-live="polite"></div>` : ''}
    </article>`).join('');
  return `
    <section class="surface-card resource-section" id="resource-${resource.id}">
      <div class="section-header"><div><p class="section-label">${payload.page.total} élément(s)</p><h2>${resource.title}</h2></div><a class="help-link" href="/help#${resource.id}">Aide</a></div>
      ${resource.summary ? `<p class="resource-summary" role="status">${escapeHtml(resource.summary(payload.items))}</p>` : ''}
      ${can(resource.write) && resource.create !== false ? `
        <details class="editor-panel">
          <summary>${t('add')}</summary>
          <form class="form-grid resource-form" data-resource="${resource.id}">
            <input type="hidden" name="_recordId">
            ${resource.fields.map((field) => fieldInput(field)).join('')}
            <div class="form-actions form-wide"><button class="primary-button" type="submit">Enregistrer</button><button type="reset" class="secondary-button">Annuler</button></div>
          </form>
        </details>` : ''}
      <div class="data-grid">${rows || `<div class="empty-state"><h3>${t('empty')}</h3><p>${resource.create === false ? t('noResults') : t('emptyHint')}</p></div>`}</div>
    </section>`;
}

async function loadReferences(module) {
  const paths = [...new Set(module.resources.flatMap((resource) =>
    [...resource.fields, ...(resource.action?.fields ?? [])]
      .filter((field) => field[2] === 'reference')
      .map((field) => field[4])
  ))];
  await Promise.all(paths.map(async (path) => {
    if (state.references.has(path)) return;
    state.references.set(path, { items: [], loading: true });
    try {
      state.references.set(path, await apiRequest(`${path}?limit=200`));
    } catch (error) {
      state.references.set(path, { items: [], page: { total: 0 }, error: error.message });
    }
  }));
}

async function modulePage(module) {
  app.innerHTML = shell(`<main class="content-stack" id="main-content"><section class="page-heading"><p class="section-label">${moduleLabel(module, 1)}</p><h1>${moduleLabel(module)}</h1><p>${module.description}</p></section><section class="surface-card loading-card">${t('loading')}</section></main>`, module.id);
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
    let supplement = '';
    if (module.id === 'analytics' && can('analytics.read')) {
      const query = window.location.search;
      const report = await apiRequest(`/analytics${query}`);
      const selected = new URLSearchParams(query);
      supplement = `
        <section class="surface-card resource-section">
          <div class="section-header"><div><p class="section-label">Indicateurs calculés</p><h2>Palmarès confidentiel</h2></div>
            ${can('analytics.export') ? '<div class="form-actions"><button class="secondary-button" type="button" data-analytics-export="csv">CSV</button><button class="secondary-button" type="button" data-analytics-export="json">JSON</button></div>' : ''}
          </div>
          <form class="form-grid" action="/analytics" method="get">
            <label>Période (début,fin)<input name="period" value="${escapeHtml(selected.get('period') ?? '')}" placeholder="2026-09-01,2027-06-30"></label>
            <label>Niveau<input name="levelCode" value="${escapeHtml(selected.get('levelCode') ?? '')}"></label>
            <label>Classe<input name="classId" value="${escapeHtml(selected.get('classId') ?? '')}"></label>
            <label>Programme<input name="programId" value="${escapeHtml(selected.get('programId') ?? '')}"></label>
            <label>Site<input name="campusId" value="${escapeHtml(selected.get('campusId') ?? '')}"></label>
            <label>Matière<input name="subjectId" value="${escapeHtml(selected.get('subjectId') ?? '')}"></label>
            <button class="primary-button" type="submit">Appliquer les filtres</button>
          </form>
          <p>${report.privacy.suppressed ? 'Valeurs masquées : cohorte sous le seuil de confidentialité.' : 'Valeurs calculées sur les données tenant disponibles.'}</p>
          <div class="metric-grid">${Object.entries(report.metrics).map(([metric, value]) => `<article class="metric-card"><span>${escapeHtml(metric)}</span><strong>${value ?? '—'}</strong></article>`).join('')}</div>
        </section>`;
    }
    if (module.id === 'support') {
      supplement = `
        <section class="surface-card resource-section"><p class="section-label">Centre d’aide</p><h2>FAQ et guides</h2>
          <details><summary>Premiers pas</summary><p>Créez les personnes, l’année, le programme et la classe avant l’inscription.</p></details>
          <details><summary>Connexion faible</summary><p>Les brouillons autorisés sont mis en file; notes et documents officiels exigent une connexion.</p></details>
          <details><summary>Escalade</summary><p>L1 traite l’usage, L2 la configuration, L3 l’application et L4 les fournisseurs.</p></details>
        </section>`;
    }
    app.innerHTML = shell(`<main class="content-stack" id="main-content"><section class="page-heading"><p class="section-label">${moduleLabel(module, 1)}</p><h1>${moduleLabel(module)}</h1><p>${module.description}</p><a class="help-link" href="/help#${module.id}">Ouvrir le guide de ce module</a></section>${supplement}${module.resources.map(resourceSection).join('')}</main>`, module.id);
    bindShell();
    bindResources(module);
    document.querySelectorAll('[data-analytics-export]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await downloadAnalytics(button.dataset.analyticsExport);
        } catch (error) {
          notification(error.message, 'error');
        } finally {
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    notification(error.message, 'error');
  }
}

async function dashboard() {
  app.innerHTML = shell('<main class="content-stack"><section class="page-heading"><p class="section-label">Pilotage</p><h1>Tableau de bord</h1><p>Chargement des indicateurs de votre établissement…</p></section></main>');
  bindShell();
  try {
    const roleDashboard = await apiRequest('/dashboards/me');
    const labels = {
      headcount: 'Effectifs', enrollments: 'Inscriptions', attendanceRate: 'Assiduité',
      resultAverage: 'Résultats', progressionAverage: 'Progression',
      financeCollected: 'Finances', lmsActivityCount: 'Activité LMS',
      dataQualityScore: 'Qualité'
    };
    app.innerHTML = shell(`
      <main class="content-stack" id="main-content">
        <section class="page-heading"><p class="section-label">Pilotage · ${escapeHtml(roleDashboard.experienceRole ?? roleDashboard.role)}</p><h1>Tableau de bord</h1><p>Chaque carte dépend du rôle, des permissions et des données réellement disponibles.</p></section>
        <section class="metric-grid">${roleDashboard.cards.map(({ metric, value }) => `<article class="metric-card surface-card"><span>${labels[metric] ?? metric}</span><strong>${value ?? '—'}</strong><small>${value == null ? 'Non disponible ou masqué' : 'Donnée tenant calculée'}</small></article>`).join('') || '<p class="empty-state">Aucun indicateur autorisé.</p>'}</section>
        <section class="surface-card quick-start"><h2>Prochaines actions</h2><div class="action-grid">${roleDashboard.nextSteps.map((step) => `<a class="secondary-button" href="${escapeHtml(step.path)}">${escapeHtml(step.label)}</a>`).join('') || '<p>Aucune action supplémentaire autorisée.</p>'}</div></section>
        <section class="surface-card quick-start"><h2>Espaces autorisés</h2><p>${roleDashboard.availableModules.map(escapeHtml).join(' · ') || 'Aucun module opérationnel supplémentaire.'}</p></section>
      </main>`);
    bindShell();
  } catch (error) {
    notification(error.message, 'error');
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function downloadText(filename, text, contentType = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: contentType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadImportTemplate(kind) {
  const response = await fetch(`/imports/templates/${encodeURIComponent(kind)}`, {
    headers: { authorization: `Bearer ${state.token}` }
  });
  if (!response.ok) throw new Error('Impossible de télécharger le modèle.');
  downloadText(`${kind}-import-template.csv`, await response.text());
}

function renderImportResult(result) {
  return `
    <div class="resource-summary" role="status">${result.dryRun ? 'Aperçu sans écriture' : 'Import appliqué'} · ${result.summary.valid}/${result.summary.total} ligne(s) valide(s) · ${result.summary.invalid} erreur(s)</div>
    ${result.errors.length ? `<ul class="error-list">${result.errors.map((error) => `<li><strong>Ligne ${error.rowNumber}</strong> — ${escapeHtml(error.message)}</li>`).join('')}</ul>` : ''}
    <div class="table-scroll"><table><thead><tr><th>Ligne</th><th>État</th><th>Données</th></tr></thead><tbody>${result.rows.map((row) => `<tr><td>${row.rowNumber}</td><td>${row.errors?.length ? 'À corriger' : 'Valide'}</td><td><code>${escapeHtml(JSON.stringify(row.values ?? row.created ?? row))}</code></td></tr>`).join('')}</tbody></table></div>`;
}

async function importsPage() {
  app.innerHTML = shell('<main class="content-stack" id="main-content"><section class="page-heading"><p class="section-label">Opérations quotidiennes</p><h1>Imports CSV/XLSX</h1><p>Chargement des classes autorisées…</p></section></main>', 'imports');
  bindShell();
  const selected = new URLSearchParams(window.location.search);
  const initialKind = ['learners', 'staff', 'class-roster'].includes(selected.get('kind')) ? selected.get('kind') : 'learners';
  let classes = { items: [] };
  try {
    classes = await apiRequest('/academics/classes?limit=200');
  } catch (error) {
    notification(error.message, 'error');
  }
  app.innerHTML = shell(`
    <main class="content-stack" id="main-content">
      <section class="page-heading"><p class="section-label">Opérations quotidiennes</p><h1>Imports CSV/XLSX</h1><p>Les imports officiels nécessitent une connexion, un aperçu sans écriture et une confirmation explicite.</p><a class="help-link" href="/help#bulk-import">Lire le guide et les schémas</a></section>
      <section class="surface-card resource-section">
        <h2>1. Préparer et prévisualiser</h2>
        <form id="import-form" class="form-grid">
          <label>Type d’import<select name="kind"><option value="learners" ${initialKind === 'learners' ? 'selected' : ''}>Apprenants / étudiants</option><option value="class-roster" ${initialKind === 'class-roster' ? 'selected' : ''}>Liste d’une classe</option><option value="staff" ${initialKind === 'staff' ? 'selected' : ''}>Enseignants / formateurs</option></select></label>
          <label>Classe cible<select name="classId"><option value="">Selon classCode du fichier</option>${classes.items.map((item) => `<option value="${escapeHtml(item.id)}" ${selected.get('classId') === item.id ? 'selected' : ''}>${escapeHtml(item.name || item.code || item.id)}</option>`).join('')}</select><small class="field-status">${classes.items.length ? `${classes.items.length} classe(s) autorisée(s).` : 'Aucune classe disponible. Créez année, programme et classe avant un import d’apprenants.'}</small></label>
          <label class="form-wide">Fichier CSV ou XLSX (5 Mio, 1 000 lignes maximum)<input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></label>
          <div class="form-actions form-wide"><button class="secondary-button" id="template-download" type="button">Télécharger le modèle CSV</button><button class="primary-button" type="submit">Prévisualiser sans écrire</button></div>
        </form>
      </section>
      <section class="surface-card resource-section" id="import-result" aria-live="polite"><h2>2. Résultat de validation</h2><p>Aucun fichier prévisualisé.</p></section>
    </main>`, 'imports');
  bindShell();

  const form = document.querySelector('#import-form');
  const resultRegion = document.querySelector('#import-result');
  let pendingPayload = null;
  document.querySelector('#template-download').addEventListener('click', async () => {
    try {
      await downloadImportTemplate(new FormData(form).get('kind'));
    } catch (error) {
      notification(error.message, 'error');
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!navigator.onLine) {
      notification('Une connexion est requise pour prévisualiser et appliquer un import officiel.', 'error');
      return;
    }
    const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) {
      notification('Sélectionnez un fichier CSV ou XLSX.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notification('Le fichier dépasse la limite de 5 Mio.', 'error');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    resultRegion.innerHTML = '<h2>Validation en cours…</h2>';
    try {
      pendingPayload = {
        organizationId: state.user.organizationId,
        kind: data.get('kind'),
        classId: data.get('classId') || null,
        fileName: file.name,
        contentBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
        idempotencyKey: crypto.randomUUID()
      };
      const preview = await apiRequest('/imports/preview', { method: 'POST', body: JSON.stringify(pendingPayload) });
      resultRegion.innerHTML = `<h2>2. Résultat de validation</h2>${renderImportResult(preview)}${preview.summary.invalid === 0 ? '<button class="primary-button" id="apply-import" type="button">Confirmer et appliquer en ligne</button>' : '<p>Corrigez toutes les erreurs avant l’application.</p>'}`;
      document.querySelector('#apply-import')?.addEventListener('click', async (applyEvent) => {
        if (!navigator.onLine || !window.confirm('Confirmer l’import officiel de toutes les lignes valides ?')) return;
        applyEvent.currentTarget.disabled = true;
        try {
          const applied = await apiRequest('/imports/apply', {
            method: 'POST',
            body: JSON.stringify({ ...pendingPayload, confirmed: true })
          });
          resultRegion.innerHTML = `<h2>Import terminé</h2>${renderImportResult(applied)}${applied.credentials?.length ? '<button class="primary-button" id="credentials-download" type="button">Télécharger les identifiants temporaires (une fois)</button>' : ''}`;
          if (applied.credentials?.length) {
            let credentials = applied.credentials;
            document.querySelector('#credentials-download').addEventListener('click', (downloadEvent) => {
              const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
              downloadText(`identifiants-${applied.batchId}.csv`, [
                'rowNumber,username,email,temporaryPassword',
                ...credentials.map((item) => [item.rowNumber, item.username, item.email, item.temporaryPassword].map(escape).join(','))
              ].join('\n'));
              credentials = [];
              applied.credentials = [];
              downloadEvent.currentTarget.disabled = true;
              downloadEvent.currentTarget.textContent = 'Identifiants téléchargés';
            }, { once: true });
          }
          pendingPayload = null;
        } catch (error) {
          notification(error.message, 'error');
          applyEvent.currentTarget.disabled = false;
        }
      });
    } catch (error) {
      pendingPayload = null;
      resultRegion.innerHTML = `<h2>Validation impossible</h2><p class="feedback feedback--error">${escapeHtml(error.message)}</p>`;
    } finally {
      button.disabled = false;
    }
  });
}

async function profilePage() {
  app.innerHTML = shell('<main class="content-stack"><section class="page-heading"><p class="section-label">Identité</p><h1>Mon profil</h1><p>Chargement du profil privé…</p></section></main>', 'myProfile');
  bindShell();
  try {
    const profile = await apiRequest('/profile/me');
    app.innerHTML = shell(`
      <main class="content-stack" id="main-content">
        <section class="page-heading"><p class="section-label">Self-service limité</p><h1>Mon profil</h1><p>Vous pouvez modifier vos contacts et préférences. Les rôles, affectations et champs officiels restent administrés par l’établissement.</p><a class="help-link" href="/help#profiles">Confidentialité et permissions</a></section>
        <section class="surface-card profile-layout">
          <div>
            ${profile.avatar ? `<img class="profile-avatar" data-secure-image="/people/${encodeURIComponent(profile.id)}/avatar" alt="Photo de profil">` : '<div class="profile-avatar profile-avatar--empty" aria-label="Aucune photo">?</div>'}
            <form id="avatar-form"><label>Photo PNG/JPEG (2 Mio maximum)<input name="file" type="file" accept="image/png,image/jpeg" required></label><button class="secondary-button" type="submit">Remplacer la photo</button></form>
          </div>
          <form id="profile-form" class="form-grid">
            <label>Prénom officiel<input value="${escapeHtml(profile.givenName)}" disabled></label>
            <label>Nom officiel<input value="${escapeHtml(profile.familyName)}" disabled></label>
            <label>Nom usuel<input name="preferredName" value="${escapeHtml(profile.preferredName ?? '')}"></label>
            <label>Langue<select name="preferredLocale">${SUPPORTED_LOCALES.map((locale) => `<option value="${locale}" ${profile.preferredLocale === locale ? 'selected' : ''}>${locale.toUpperCase()}</option>`).join('')}</select></label>
            <label>Pays<select name="countryCode"><option value="">Non renseigné</option>${countryOptions(profile.countryCode)}</select></label>
            <label>Fuseau horaire<input name="timezone" value="${escapeHtml(profile.timezone ?? '')}" placeholder="Africa/Dakar"></label>
            <label class="form-wide">Adresse<textarea name="address">${escapeHtml(profile.address ?? '')}</textarea></label>
            <label class="form-wide">Biographie<textarea name="bio">${escapeHtml(profile.bio ?? '')}</textarea></label>
            <label class="form-wide">Contacts (JSON)<textarea name="contacts">${escapeHtml(JSON.stringify(profile.contacts ?? []))}</textarea></label>
            <label class="form-wide">Préférences d’accessibilité (JSON)<textarea name="accessibility">${escapeHtml(JSON.stringify(profile.accessibility ?? {}))}</textarea></label>
            <label class="form-wide">Préférences de notification (JSON)<textarea name="notifications">${escapeHtml(JSON.stringify(profile.notifications ?? {}))}</textarea></label>
            <label class="checkbox-row"><input name="privacyConsent" type="checkbox" ${profile.privacyConsent ? 'checked' : ''}> J’accepte le stockage des informations privées optionnelles.</label>
            <label class="form-wide">Contact d’urgence (JSON, avec consentement)<textarea name="emergencyContact">${escapeHtml(JSON.stringify(profile.emergencyContact ?? null))}</textarea></label>
            <button class="primary-button" type="submit">Enregistrer mes préférences</button>
          </form>
        </section>
        <section class="surface-card resource-section"><h2>Rôles et affectations en lecture seule</h2><p>${profile.roles.map((role) => escapeHtml(role.name)).join(' · ') || 'Aucun rôle affiché.'}</p><p>${profile.professionalAssignments.map((assignment) => escapeHtml(assignment.roleTitle)).join(' · ') || 'Aucune affectation professionnelle.'}</p></section>
      </main>`, 'myProfile');
    bindShell();
    await loadSecureImages();
    document.querySelector('#profile-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const body = Object.fromEntries(data.entries());
      try {
        body.privacyConsent = data.get('privacyConsent') === 'on';
        for (const field of ['contacts', 'accessibility', 'notifications', 'emergencyContact']) {
          body[field] = JSON.parse(body[field] || (field === 'contacts' ? '[]' : '{}'));
        }
        if (!body.address) delete body.address;
        await apiRequest('/profile/me', { method: 'PUT', body: JSON.stringify(body) });
        notification('Profil enregistré.');
      } catch (error) {
        notification(error.message, 'error');
      }
    });
    document.querySelector('#avatar-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        await apiUpload('/profile/me/avatar', data);
        notification('Photo de profil enregistrée.');
        await profilePage();
      } catch (error) {
        notification(error.message, 'error');
      }
    });
  } catch (error) {
    notification(error.message, 'error');
  }
}

async function identityAssetsPage() {
  app.innerHTML = shell('<main class="content-stack"><section class="page-heading"><p class="section-label">Identité institutionnelle</p><h1>Logo, signatures et preuves</h1><p>Chargement des médias sécurisés…</p></section></main>', 'identityAssets');
  bindShell();
  const organizationId = state.user.organizationId;
  try {
    const [branding, signatures, people, documents] = await Promise.all([
      can('organizations.read') ? apiRequest(`/organizations/${organizationId}/branding`) : null,
      can('credentials.read') ? apiRequest(`/signatures?organizationId=${encodeURIComponent(organizationId)}`) : { items: [] },
      can('people.read') ? apiRequest('/people?limit=200') : { items: [] },
      can('documents.read') ? apiRequest('/documents?limit=200') : { items: [] }
    ]);
    const evidence = documents.items.filter((document) => document.metadata?.source === 'evidence-upload');
    const peopleOptions = people.items.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(`${person.givenName} ${person.familyName}`)}</option>`).join('');
    app.innerHTML = shell(`
      <main class="content-stack" id="main-content">
        <section class="page-heading"><p class="section-label">Configuration et dossiers</p><h1>Identité, signatures et preuves</h1><p>Les images et preuves sont vérifiées puis stockées en base; aucune signature électronique qualifiée n’est revendiquée.</p><a class="help-link" href="/help#documents">Règles, limites et workflow</a></section>
        ${can('organizations.write') ? `<section class="surface-card resource-section"><h2>Logo institutionnel</h2>${branding ? `<img class="institution-logo-preview" src="/public/organizations/${encodeURIComponent(organizationId)}/logo" alt="${escapeHtml(branding.altText)}"><p>SHA-256 ${escapeHtml(branding.sha256)}</p>` : '<p class="empty-state">Aucun logo configuré.</p>'}<form id="logo-form" class="form-grid"><label>Logo PNG/JPEG (1 Mio, 4096×4096 max.)<input name="file" type="file" accept="image/png,image/jpeg" required></label><label>Texte alternatif<input name="altText" value="Logo institutionnel" required></label><button class="primary-button" type="submit">${branding ? 'Remplacer' : 'Ajouter'} le logo</button>${branding ? '<button class="danger-button" id="remove-logo" type="button">Supprimer le logo</button>' : ''}</form></section>` : ''}
        ${can('credentials.write') ? `<section class="surface-card resource-section"><h2>Signataires habilités</h2><p>Une signature est une marque visuelle auditée, révocable et liée à une personne/fonction.</p><form id="signature-form" class="form-grid"><label>Titulaire<select name="personId" required><option value="">Sélectionner</option>${peopleOptions}</select></label><label>Fonction<input name="function" required></label><label>Objectif<input name="purpose" required placeholder="Délivrance des attestations"></label><label>Image PNG/JPEG (1 Mio)<input name="file" type="file" accept="image/png,image/jpeg" required></label><button class="primary-button" type="submit">Ajouter la signature</button></form><div class="record-grid">${signatures.items.map((signature) => `<article class="record-card"><img class="signature-preview" data-secure-image="/signatures/${encodeURIComponent(signature.id)}/content" alt="Signature de ${escapeHtml(signature.holderName)}"><h3>${escapeHtml(signature.holderName)}</h3><p>${escapeHtml(signature.function)} · ${escapeHtml(signature.purpose)}</p><p>${signature.active ? 'Active' : 'Révoquée'} · SHA-256 ${escapeHtml(signature.sha256.slice(0, 12))}…</p>${signature.active ? `<button class="danger-button" data-revoke-signature="${escapeHtml(signature.id)}" type="button">Révoquer</button>` : ''}</article>`).join('') || '<p class="empty-state">Aucun signataire configuré.</p>'}</div></section>` : ''}
        ${can('documents.write') ? `<section class="surface-card resource-section"><h2>Importer un document de preuve</h2><form id="evidence-form" class="form-grid"><label>Personne<select name="personId" required><option value="">Sélectionner</option>${peopleOptions}</select></label><label>Type<select name="type"><option value="receipt">Reçu</option><option value="report-card">Bulletin</option><option value="certificate">Certificat</option><option value="attestation">Attestation</option><option value="diploma">Diplôme</option></select></label><label>Titre<input name="title" required></label><label>Fichier PDF/PNG/JPEG (8 Mio)<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required></label><button class="primary-button" type="submit">Importer la preuve</button></form></section>` : ''}
        <section class="surface-card resource-section"><h2>Preuves importées</h2><div class="record-grid">${evidence.map((document) => `<article class="record-card"><h3>${escapeHtml(document.title)}</h3><p>${escapeHtml(document.type)} · ${escapeHtml(document.metadata.verification.status)}</p><p>SHA-256 ${escapeHtml(document.fileHash.slice(0, 16))}…</p><button class="secondary-button" data-download-evidence="${escapeHtml(document.id)}" data-file-name="${escapeHtml(document.metadata.fileName)}" type="button">Télécharger</button>${can('documents.verify') && document.metadata.verification.status === 'pending' ? `<button class="primary-button" data-verify-evidence="${escapeHtml(document.id)}" type="button">Valider</button>` : ''}</article>`).join('') || '<p class="empty-state">Aucune preuve importée.</p>'}</div></section>
      </main>`, 'identityAssets');
    bindShell();
    await loadSecureImages();
    for (const [formId, path] of [['logo-form', `/organizations/${organizationId}/branding/logo`], ['signature-form', '/signatures'], ['evidence-form', '/documents/evidence']]) {
      document.querySelector(`#${formId}`)?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (formId !== 'logo-form') data.append('organizationId', organizationId);
        try {
          await apiUpload(path, data);
          notification('Fichier enregistré et audité.');
          await identityAssetsPage();
        } catch (error) {
          notification(error.message, 'error');
        }
      });
    }
    document.querySelector('#remove-logo')?.addEventListener('click', async () => {
      if (!window.confirm('Supprimer le logo institutionnel ?')) return;
      try {
        await apiRequest(`/organizations/${organizationId}/branding/logo`, { method: 'DELETE' });
        await identityAssetsPage();
      } catch (error) {
        notification(error.message, 'error');
      }
    });
    document.querySelectorAll('[data-revoke-signature]').forEach((button) => button.addEventListener('click', async () => {
      const reason = window.prompt('Motif de révocation');
      if (!reason) return;
      try {
        await apiRequest(`/signatures/${button.dataset.revokeSignature}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
        await identityAssetsPage();
      } catch (error) {
        notification(error.message, 'error');
      }
    }));
    document.querySelectorAll('[data-download-evidence]').forEach((button) => button.addEventListener('click', () =>
      downloadAuthenticated(`/documents/${button.dataset.downloadEvidence}/content`, button.dataset.fileName)
        .catch((error) => notification(error.message, 'error'))
    ));
    document.querySelectorAll('[data-verify-evidence]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await apiRequest(`/documents/${button.dataset.verifyEvidence}/verification`, {
          method: 'POST',
          body: JSON.stringify({ status: 'verified' })
        });
        await identityAssetsPage();
      } catch (error) {
        notification(error.message, 'error');
      }
    }));
  } catch (error) {
    notification(error.message, 'error');
  }
}

async function learningPathPage() {
  app.innerHTML = shell('<main class="content-stack"><section class="page-heading"><p class="section-label">Apprentissage</p><h1>Mon parcours</h1><p>Calcul des prérequis côté serveur…</p></section></main>', 'learningPath');
  bindShell();
  try {
    const [enrollments, signatures] = await Promise.all([
      apiRequest('/lms/enrollments?limit=100'),
      can('credentials.read')
        ? apiRequest(`/signatures?organizationId=${encodeURIComponent(state.user.organizationId)}`)
        : { items: [] }
    ]);
    const activeSignatures = signatures.items.filter((signature) => signature.active && !signature.revokedAt);
    const accessible = [];
    for (const enrollment of enrollments.items) {
      try {
        accessible.push({ enrollment, progress: await apiRequest(`/lms/enrollments/${enrollment.id}/progress-detail`) });
      } catch {
        // Other learners' enrollments are intentionally hidden.
      }
    }
    app.innerHTML = shell(`
      <main class="content-stack" id="main-content">
        <section class="page-heading"><p class="section-label">Parcours serveur</p><h1>Leçons, examen final et titres</h1><p>Les leçons suivantes et l’examen restent verrouillés tant que les exigences précédentes ne sont pas satisfaites.</p><a class="help-link" href="/help#lms">Comprendre les règles de progression</a></section>
        ${accessible.map(({ enrollment, progress }) => `<section class="surface-card resource-section"><div class="section-header"><div><p class="section-label">Inscription ${escapeHtml(enrollment.id)}</p><h2>${progress.percent}% terminé</h2></div><strong>${progress.eligibleForTitle ? 'Titre délivrable' : progress.finalExamUnlocked ? 'Examen final disponible' : 'Parcours en cours'}</strong></div><div class="progress-track" role="progressbar" aria-label="Progression du parcours" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><span style="width:${progress.percent}%"></span></div><ol class="learning-sequence">${progress.lessons.map((lesson) => `<li class="${lesson.locked ? 'is-locked' : lesson.completed ? 'is-complete' : ''}"><strong>${escapeHtml(lesson.title)}</strong><span>${lesson.completed ? 'Validée' : lesson.locked ? escapeHtml(lesson.lockReason) : 'Disponible'}</span>${!lesson.completed && !lesson.locked ? `<button class="primary-button" data-complete-lesson="${escapeHtml(lesson.id)}" data-enrollment="${escapeHtml(enrollment.id)}" type="button">Valider la leçon</button>` : ''}</li>`).join('')}</ol>${progress.eligibleForTitle && can('lms.write') && can('credentials.write') ? `<form class="title-form form-grid" data-enrollment="${escapeHtml(enrollment.id)}"><label>Type de titre<select name="titleType"><option value="certificate">Certificat</option><option value="attestation">Attestation</option><option value="diploma">Diplôme</option></select></label><label>Signataire actif<select name="signatureId" required><option value="">Sélectionner</option>${activeSignatures.map((signature) => `<option value="${escapeHtml(signature.id)}">${escapeHtml(signature.holderName)} — ${escapeHtml(signature.function)}</option>`).join('')}</select></label><button class="primary-button" type="submit" ${activeSignatures.length ? '' : 'disabled'}>Délivrer le titre</button><small class="form-wide">${activeSignatures.length ? 'Titre émis par la plateforme; aucune accréditation officielle n’est affirmée sans autorité configurée.' : 'Configurez d’abord un signataire actif dans Identité & preuves.'}</small></form>` : ''}</section>`).join('') || '<section class="surface-card empty-state"><h2>Aucun parcours accessible</h2><p>Un administrateur doit créer un participant et une inscription LMS.</p></section>'}
      </main>`, 'learningPath');
    bindShell();
    document.querySelectorAll('[data-complete-lesson]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await apiRequest(`/lms/enrollments/${button.dataset.enrollment}/lessons/${button.dataset.completeLesson}/complete`, {
          method: 'POST',
          body: '{}'
        });
        await learningPathPage();
      } catch (error) {
        notification(error.message, 'error');
      }
    }));
    document.querySelectorAll('.title-form').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const printWindow = window.open('', '_blank');
      try {
        const body = Object.fromEntries(new FormData(event.currentTarget));
        body.signatureIds = [body.signatureId];
        delete body.signatureId;
        const result = await apiRequest(`/lms/enrollments/${event.currentTarget.dataset.enrollment}/titles`, {
          method: 'POST',
          body: JSON.stringify(body)
        });
        notification(`Titre ${result.credential.credentialNumber} délivré.`);
        await openAuthenticatedHtml(`/credentials/${result.credential.id}/print`, printWindow);
      } catch (error) {
        printWindow?.close();
        notification(error.message, 'error');
      }
    }));
  } catch (error) {
    notification(error.message, 'error');
  }
}

async function helpPage() {
  app.innerHTML = shell('<main class="content-stack" id="main-content"><section class="page-heading"><p class="section-label">Aide</p><h1>Guide des modules</h1><p>Chargement du guide versionné…</p></section></main>', 'help');
  bindShell();
  try {
    const help = await apiRequest('/support/help');
    app.innerHTML = shell(`
      <main class="content-stack" id="main-content">
        <section class="page-heading"><p class="section-label">Guide v${escapeHtml(help.version)}</p><h1>Guide des modules</h1><p>Permissions, prérequis, actions et parcours recommandés. La traduction métier est progressive avec fallback français non vide.</p></section>
        ${help.guides.map((guide) => `<section class="surface-card resource-section" id="${escapeHtml(guide.id)}"><p class="section-label">${escapeHtml(guide.audience.join(' · '))}</p><h2>${escapeHtml(guide.title)}</h2><p><strong>Permissions :</strong> ${guide.permissions.map(escapeHtml).join(', ')}</p><p><strong>Prérequis :</strong> ${guide.prerequisites.map(escapeHtml).join(' → ')}</p><ol>${guide.workflow.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><p><strong>Actions :</strong> ${guide.actions.map(escapeHtml).join(' · ')}</p></section>`).join('')}
        <section class="surface-card resource-section"><h2>Questions fréquentes</h2>${help.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>
      </main>`, 'help');
    bindShell();
  } catch (error) {
    notification(error.message, 'error');
  }
}

function bindShell() {
  const navigation = document.querySelector('#shell-nav');
  const toggle = document.querySelector('#menu-toggle');
  const backdrop = document.querySelector('#nav-backdrop');
  document.querySelector('.tenant-logo')?.addEventListener('error', (event) => {
    event.currentTarget.hidden = true;
  }, { once: true });
  const setOpen = (open) => {
    navigation?.setAttribute('data-open', String(open));
    toggle?.setAttribute('aria-expanded', String(open));
    if (backdrop) backdrop.hidden = !open;
  };
  toggle?.addEventListener('click', () => setOpen(navigation?.getAttribute('data-open') !== 'true'));
  backdrop?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      toggle?.focus();
    }
  }, { once: true });
  document.querySelector('#locale-switch')?.addEventListener('change', async (event) => {
    state.locale = event.target.value;
    window.localStorage.setItem('eduplateforme.locale', state.locale);
    applyLocale();
    await apiRequest('/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify({ locale: state.locale })
    }).catch(() => {});
    window.location.reload();
  });
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
      let body = null;
      let recordId = null;
      button.disabled = true;
      button.textContent = 'Enregistrement…';
      try {
        const formData = new FormData(form);
        recordId = formData.get('_recordId');
        body = Object.fromEntries(resource.fields.map(([name, , type]) => {
          const value = formData.get(name);
          if (type === 'json' && value) return [name, JSON.parse(value)];
          if (type === 'number' && value !== '') return [name, Number(value)];
          if (type === 'checkbox') return [name, form.elements[name].checked];
          return [name, value];
        }).filter(([, value]) => value !== ''));
        if (resource.id !== 'organizations') body.organizationId = state.user.organizationId;
        await apiRequest(recordId ? `${resource.path}/${recordId}` : (resource.createPath ?? resource.path), {
          method: recordId ? 'PUT' : 'POST',
          body: JSON.stringify(body)
        });
        notification(recordId ? 'Modification enregistrée.' : 'Élément créé.');
        await modulePage(module);
      } catch (error) {
        if (!navigator.onLine && body && queueOfflineMutation(resource.id, 'create', null, body)) {
          notification('Modification placée dans la file hors ligne.');
          button.disabled = false;
          button.textContent = 'Enregistrer';
          return;
        }
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
      const record = state.resources.get(resource.id).items.find((item) => item.id === form.dataset.id);
      const formData = new FormData(form);
      const body = Object.fromEntries(resource.action.fields.map(([name, , type]) => {
        const value = formData.get(name);
        if (type === 'json' && value) return [name, JSON.parse(value)];
        if (type === 'number' && value !== '') return [name, Number(value)];
        if (type === 'checkbox') return [name, form.elements[name].checked];
        return [name, value];
      }).filter(([, value]) => value !== ''));
      if (resource.action.idField) body[resource.action.idField] = form.dataset.id;
      const actionTemplate = typeof resource.action.path === 'function'
        ? resource.action.path(record)
        : resource.action.path;
      const actionPath = actionTemplate.replace(':id', encodeURIComponent(form.dataset.id));
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await apiRequest(actionPath, { method: 'POST', body: JSON.stringify(body) });
        const actionLabel = typeof resource.action.label === 'function'
          ? resource.action.label(record)
          : resource.action.label;
        notification(`${actionLabel} : opération enregistrée.`);
        await modulePage(module);
      } catch (error) {
        if (!navigator.onLine && queueOfflineMutation(
          resource.id,
          resource.id === 'supportTickets' ? 'comment' : 'upsert',
          record.id,
          body,
          record.updatedAt
        )) {
          notification('Modification placée dans la file hors ligne.');
          button.disabled = false;
          return;
        }
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
      for (const [name, , type] of resource.fields) {
        if (form.elements[name]) {
          form.elements[name].value = type === 'json' && record[name] != null
            ? JSON.stringify(record[name])
            : (record[name] ?? '');
        }
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
    if (!window.localStorage.getItem('eduplateforme.locale')) {
      const profile = await apiRequest('/i18n/profile').catch(() => null);
      state.locale = state.user.locale ?? profile?.language ?? state.user.profile?.preferredLocale ?? state.locale;
      if (!SUPPORTED_LOCALES.includes(state.locale)) state.locale = 'fr';
      applyLocale();
    }
    return true;
  } catch {
    setToken(null);
    state.user = null;
    return false;
  }
}

async function route() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const publicPath = path === '/' || path === '/login' || path === '/register'
    || path === '/verify-institution' || path === '/verify-credential' || path === '/password-change';
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
            <div><dt>Pays</dt><dd>${escapeHtml(countryIndicator(result.institution.countryCode))}</dd></div>
            <div><dt>Autorité</dt><dd>${formatValue(result.authority)}</dd></div>
          </dl>`;
      } catch (error) {
        notification(error.message, 'error');
      }
    });
    return;
  }
  if (path === '/verify-credential') {
    app.innerHTML = `
      <main class="public-layout">
        <a class="brand-mark public-brand" href="/">Eduplateforme</a>
        <section class="auth-card surface-card">
          <p class="section-label">Vérification publique minimisée</p>
          <h1>Vérifier un diplôme</h1>
          <p class="section-copy">Saisissez la référence opaque du QR code. Seules les données strictement nécessaires à la vérification sont affichées.</p>
          <div id="feedback" class="feedback" role="alert" tabindex="-1" hidden></div>
          <form id="credential-verification-form" class="form-grid">
            <label class="form-wide">Référence de vérification<input name="reference" required autocomplete="off"></label>
            <button class="primary-button" type="submit">Vérifier</button>
          </form>
          <section id="credential-verification-result" class="verification-result" aria-live="polite"></section>
        </section>
      </main>`;
    document.querySelector('#credential-verification-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const reference = new FormData(event.currentTarget).get('reference');
      try {
        const result = await apiRequest(`/public/credentials/verify/${encodeURIComponent(reference)}`);
        document.querySelector('#credential-verification-result').innerHTML = `
          <h2>${escapeHtml(result.qualification)}</h2>
          <dl>
            <div><dt>Statut</dt><dd>${escapeHtml(result.status)}</dd></div>
            <div><dt>Intégrité</dt><dd>${result.integrity ? 'Confirmée' : 'Non confirmée'}</dd></div>
            <div><dt>Numéro</dt><dd>${escapeHtml(result.credentialNumber)}</dd></div>
            <div><dt>Titulaire</dt><dd>${escapeHtml(`${result.holder?.givenName ?? ''} ${result.holder?.familyName ?? ''}`.trim())}</dd></div>
            <div><dt>Émetteur</dt><dd>${escapeHtml(result.issuer?.legalName)}</dd></div>
            <div><dt>Expiration</dt><dd>${formatValue(result.expiresAt)}</dd></div>
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
      if (form.dataset.challengeToken) {
        try {
          const challenge = await apiRequest('/auth/mfa/challenge', {
            method: 'POST',
            body: JSON.stringify({
              challengeToken: form.dataset.challengeToken,
              code: new FormData(form).get('code')
            })
          }, false);
          setToken(challenge.accessToken);
          window.location.assign('/dashboard');
        } catch (error) {
          notification(error.message, 'error');
        }
        return;
      }
      const body = Object.fromEntries(
        [...new FormData(form).entries()].filter(([, value]) => value !== '')
      );
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Chargement…';
      try {
        const payload = await apiRequest(`/auth/${kind}`, { method: 'POST', body: JSON.stringify(body) }, false);
        if (payload.mfaRequired) {
          form.dataset.challengeToken = payload.challengeToken;
          form.innerHTML = `
            <label class="form-wide">Code MFA ou code de récupération
              <input name="code" inputmode="numeric" autocomplete="one-time-code" required>
            </label>
            <button class="primary-button" type="submit">Valider le second facteur</button>`;
          return;
        }
        if (payload.passwordChangeRequired) {
          window.sessionStorage.setItem('eduplateforme.passwordChangeChallenge', payload.challengeToken);
          window.location.assign('/password-change');
          return;
        }
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
  if (path === '/password-change') {
    const challengeToken = window.sessionStorage.getItem('eduplateforme.passwordChangeChallenge');
    if (!challengeToken) {
      window.location.replace('/login');
      return;
    }
    app.innerHTML = `
      <main class="public-layout" id="main-content">
        <a class="brand-mark public-brand" href="/">Eduplateforme</a>
        <section class="auth-card surface-card">
          <p class="section-label">Première connexion</p>
          <h1>Remplacez le mot de passe temporaire</h1>
          <p class="section-copy">Définissez un mot de passe personnel d’au moins 10 caractères avant tout accès aux données.</p>
          <div id="feedback" class="feedback" role="alert" tabindex="-1" hidden></div>
          <form id="password-change-form" class="form-grid">
            <label class="form-wide">Nouveau mot de passe<input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
            <label class="form-wide">Confirmation<input name="confirmation" type="password" minlength="10" autocomplete="new-password" required></label>
            <button class="primary-button" type="submit">Enregistrer et continuer</button>
          </form>
        </section>
      </main>`;
    document.querySelector('#password-change-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      if (values.get('password') !== values.get('confirmation')) {
        notification('Les mots de passe ne correspondent pas.', 'error');
        return;
      }
      try {
        const payload = await apiRequest('/auth/password/change-required', {
          method: 'POST',
          body: JSON.stringify({ challengeToken, password: values.get('password') })
        }, false);
        window.sessionStorage.removeItem('eduplateforme.passwordChangeChallenge');
        setToken(payload.accessToken);
        state.user = payload.user;
        window.location.assign('/dashboard');
      } catch (error) {
        notification(error.message, 'error');
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
        const body = Object.fromEntries(
          [...new FormData(form).entries()].filter(([, value]) => value !== '')
        );
        for (const field of ['headquartersAddress', 'officialContact']) {
          if (body[field]) body[field] = JSON.parse(body[field]);
          else delete body[field];
        }
        const payload = await apiRequest('/auth/onboarding', { method: 'POST', body: JSON.stringify(body) });
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
  if (path === '/imports') {
    await importsPage();
    return;
  }
  if (path === '/profile') {
    await profilePage();
    return;
  }
  if (path === '/identity-assets') {
    await identityAssetsPage();
    return;
  }
  if (path === '/learning-path') {
    await learningPathPage();
    return;
  }
  if (path === '/help') {
    await helpPage();
    return;
  }
  const module = modules.find((candidate) => candidate.path === path);
  if (module) {
    await modulePage(module);
  }
}

window.addEventListener('online', () => synchronizeOfflineQueue().then(() => route()).catch(() => {}));
window.addEventListener('offline', () => route());
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}
await route();
await synchronizeOfflineQueue().catch(() => {});
