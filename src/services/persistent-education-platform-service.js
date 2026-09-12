import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { FoundationService } from '../application/foundation-service.js';
import { EducationPlatformService } from './education-platform-service.js';
import { AcademicYear, Enrollment, Learner, LearningClass, Program } from '../domain/academics/academics.js';
import { UserAccount } from '../domain/accounts/user-account.js';
import { Assignment, AssignmentSubmission } from '../domain/assignments/assignments.js';
import { AttendanceRecord } from '../domain/attendance/attendance.js';
import { DomainEvent } from '../domain/audit/domain-event.js';
import { Permission, PermissionGrant, Role, RoleAssignment } from '../domain/authorization/authorization.js';
import { CalendarEvent } from '../domain/calendar/calendar.js';
import { Certificate } from '../domain/certificates/certificates.js';
import { DiscussionThread, ThreadMessage } from '../domain/communications/communications.js';
import { DisciplineRecord } from '../domain/discipline/discipline.js';
import {
  CollaborationRequest,
  ConsentRecord,
  CredentialRecord,
  DocumentRecord,
  DocumentShare,
  DocumentTemplate,
  TransferRecord
} from '../domain/documents/documents.js';
import { FeeConfiguration, Invoice, Payment } from '../domain/finance/finance.js';
import { GradeEntry, GradingSystem } from '../domain/grading/grading.js';
import { LocalizationProfile } from '../domain/i18n/i18n.js';
import {
  DataQualityRule,
  EmisProfile,
  ExternalProvider,
  PlatformRecord,
  ReferenceEntry
} from '../domain/learning-systems/learning-systems.js';
import {
  AnalyticsConfiguration,
  HIGH_IMPACT_AI_ACTIONS,
  OperationalRecord,
  SAFE_AI_ASSISTANCE_ACTIONS,
  SaasPlan,
  SupportTicket
} from '../domain/operations/operations.js';
import {
  AcademicLevel,
  AcademicPeriod,
  Accreditation,
  Campus,
  ContextualPermissionRule,
  Course,
  GuardianLearnerRelation,
  GuardianProfile,
  InstitutionVerification,
  LearnerLifecycleEvent,
  OperatingAuthorization,
  ProfessionalAssignment,
  ProfessionalProfile,
  Subject,
  AUTHORIZATION_STATUSES,
  VERIFICATION_STATUSES
} from '../domain/institutional/institutional.js';
import { Notification } from '../domain/notifications/notifications.js';
import { Organization } from '../domain/organizations/organization.js';
import { Person } from '../domain/people/person.js';
import { ReportCard } from '../domain/reports/reports.js';
import { ScheduleEntry } from '../domain/scheduling/scheduling.js';
import { PlatformSubscription } from '../domain/subscriptions/subscriptions.js';
import { VirtualSchool, PaidTraining } from '../domain/virtual-schools/virtual-schools.js';
import { createPermanentId, ValidationError } from '../shared/entity.js';
import { createDatabaseConnection, openDatabaseConnection } from '../db/connection.js';
import { createCollectionRepository } from '../db/repositories/base-repository.js';
import { OrganizationRepository } from '../db/repositories/organization-repository.js';
import { PersonRepository } from '../db/repositories/person-repository.js';
import { UserAccountRepository } from '../db/repositories/user-account-repository.js';
import { GradeRepository } from '../db/repositories/grade-repository.js';
import { AttendanceRepository } from '../db/repositories/attendance-repository.js';
import { AssignmentRepository } from '../db/repositories/assignment-repository.js';
import { MessageRepository } from '../db/repositories/message-repository.js';
import { DisciplineRecordRepository } from '../db/repositories/discipline-record-repository.js';
import { CalendarEventRepository } from '../db/repositories/calendar-event-repository.js';
import { SubscriptionRepository } from '../db/repositories/subscription-repository.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { createRefreshToken, signJwt, verifyJwt } from '../security/tokens.js';
import {
  createRecoveryCodes,
  createTotpSecret,
  decryptMfaSecret,
  encryptMfaSecret,
  hashRecoveryCode,
  verifyTotp
} from '../security/totp.js';
import { executeBulkImport } from './bulk-import-service.js';
import { domainVerificationInstructions, normalizeCustomDomain, verifyDomainTxt } from './custom-domain-service.js';
import { createDomainProvider } from './domain-provider.js';
import {
  assertEvidenceType,
  createAssetRecord,
  deleteBlob,
  readBlob,
  saveBlob,
  validateAsset
} from './secure-assets-service.js';

const COLLECTIONS = {
  organizations: { hydrate: (value) => new Organization(value, { validate: false }), repository: (connection) => new OrganizationRepository({ connection }) },
  people: { hydrate: (value) => new Person(value), repository: (connection) => new PersonRepository({ connection }) },
  accounts: { hydrate: (value) => new UserAccount(value), repository: (connection) => new UserAccountRepository({ connection }) },
  permissions: { hydrate: (value) => new Permission(value) },
  roles: { hydrate: (value) => new Role(value) },
  roleAssignments: { hydrate: (value) => new RoleAssignment(value) },
  permissionGrants: { hydrate: (value) => new PermissionGrant(value) },
  learners: { hydrate: (value) => new Learner(value) },
  academicYears: { hydrate: (value) => new AcademicYear(value, { validate: false }) },
  programs: { hydrate: (value) => new Program(value) },
  classes: { hydrate: (value) => new LearningClass(value) },
  enrollments: { hydrate: (value) => new Enrollment(value) },
  documents: { hydrate: (value) => new DocumentRecord(value) },
  credentials: { hydrate: (value) => new CredentialRecord(value) },
  documentTemplates: { hydrate: (value) => new DocumentTemplate(value) },
  documentShares: { hydrate: (value) => new DocumentShare(value), sensitive: true },
  tenantBranding: { hydrate: (value) => new PlatformRecord(value) },
  managedSignatures: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  consents: { hydrate: (value) => new ConsentRecord(value), sensitive: true },
  collaborationRequests: { hydrate: (value) => new CollaborationRequest(value), sensitive: true },
  transfers: { hydrate: (value) => new TransferRecord(value), sensitive: true },
  gradingSystems: { hydrate: (value) => new GradingSystem(value) },
  grades: { hydrate: (value) => new GradeEntry(value), repository: (connection) => new GradeRepository({ connection }), sensitive: true },
  attendance: { hydrate: (value) => new AttendanceRecord(value), repository: (connection) => new AttendanceRepository({ connection }) },
  scheduleEntries: { hydrate: (value) => new ScheduleEntry(value) },
  assignments: {
    hydrate: (value) => new Assignment({
      ...value,
      legacyRecipientScope: value.legacyRecipientScope ?? !Object.hasOwn(value, 'recipientLearnerIds')
    }),
    repository: (connection) => new AssignmentRepository({ connection })
  },
  assignmentSubmissions: { hydrate: (value) => new AssignmentSubmission(value) },
  customDomains: { hydrate: (value) => new PlatformRecord(value) },
  domainTldCatalog: { hydrate: (value) => new PlatformRecord(value) },
  domainQuotes: { hydrate: (value) => new PlatformRecord(value) },
  domainOrders: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  domainLifecycleEvents: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  reportCards: { hydrate: (value) => new ReportCard(value) },
  fees: { hydrate: (value) => new FeeConfiguration(value, { validate: false }) },
  invoices: { hydrate: (value) => new Invoice(value) },
  payments: { hydrate: (value) => new Payment(value) },
  notifications: { hydrate: (value) => new Notification(value) },
  threads: { hydrate: (value) => new DiscussionThread(value) },
  messages: { hydrate: (value) => new ThreadMessage(value), repository: (connection) => new MessageRepository({ connection }) },
  disciplineRecords: { hydrate: (value) => new DisciplineRecord(value), repository: (connection) => new DisciplineRecordRepository({ connection }), sensitive: true },
  calendarEvents: { hydrate: (value) => new CalendarEvent(value), repository: (connection) => new CalendarEventRepository({ connection }) },
  virtualSchools: { hydrate: (value) => new VirtualSchool(value) },
  paidTrainings: { hydrate: (value) => new PaidTraining(value) },
  certificates: { hydrate: (value) => new Certificate(value) },
  localizationProfiles: { hydrate: (value) => new LocalizationProfile(value, { validate: false }), keySelector: (value) => value.organizationId },
  platformSubscriptions: { hydrate: (value) => new PlatformSubscription(value), repository: (connection) => new SubscriptionRepository({ connection }) },
  parentalConsents: { hydrate: (value) => ({ ...value }) },
  campuses: { hydrate: (value) => new Campus(value) },
  operatingAuthorizations: { hydrate: (value) => new OperatingAuthorization(value) },
  accreditations: { hydrate: (value) => new Accreditation(value) },
  institutionVerifications: { hydrate: (value) => new InstitutionVerification(value) },
  guardianProfiles: { hydrate: (value) => new GuardianProfile(value), sensitive: true },
  professionalProfiles: { hydrate: (value) => new ProfessionalProfile(value), sensitive: true },
  guardianLearnerRelations: { hydrate: (value) => new GuardianLearnerRelation(value), sensitive: true },
  professionalAssignments: { hydrate: (value) => new ProfessionalAssignment(value) },
  academicPeriods: { hydrate: (value) => new AcademicPeriod(value, { validate: false }) },
  academicLevels: { hydrate: (value) => new AcademicLevel(value) },
  subjects: { hydrate: (value) => new Subject(value) },
  courses: { hydrate: (value) => new Course(value) },
  learnerLifecycleEvents: { hydrate: (value) => new LearnerLifecycleEvent(value), sensitive: true },
  contextualPermissionRules: { hydrate: (value) => new ContextualPermissionRule(value) },
  lmsCatalogs: { hydrate: (value) => new PlatformRecord(value) },
  lmsPrograms: { hydrate: (value) => new PlatformRecord(value) },
  lmsCourses: { hydrate: (value) => new PlatformRecord(value) },
  lmsModules: { hydrate: (value) => new PlatformRecord(value) },
  lmsLessons: { hydrate: (value) => new PlatformRecord(value) },
  lmsResources: { hydrate: (value) => new PlatformRecord(value) },
  lmsParticipants: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  lmsEnrollments: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  lmsProgress: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  lmsQuizzes: { hydrate: (value) => new PlatformRecord(value) },
  lmsQuestions: { hydrate: (value) => new PlatformRecord(value) },
  lmsAttempts: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  lmsAssessments: { hydrate: (value) => new PlatformRecord(value) },
  lmsPayments: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  lmsCertificates: { hydrate: (value) => new PlatformRecord(value) },
  meetingProviders: { hydrate: (value) => new ExternalProvider(value) },
  meetings: { hydrate: (value) => new PlatformRecord(value) },
  meetingParticipants: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  meetingAttendance: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  dataQualityRules: { hydrate: (value) => new DataQualityRule(value) },
  dataQualityRuns: { hydrate: (value) => new PlatformRecord(value) },
  dataQualityIssues: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  emisProfiles: { hydrate: (value) => new EmisProfile(value) },
  emisMappings: { hydrate: (value) => new PlatformRecord(value) },
  emisNationalReferences: { hydrate: (value) => new PlatformRecord(value) },
  emisExchanges: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  referenceEntries: { hydrate: (value) => new ReferenceEntry(value) },
  userLocalizationProfiles: { hydrate: (value) => new PlatformRecord(value), sensitive: true },
  analyticsConfigurations: { hydrate: (value) => new AnalyticsConfiguration(value) },
  supportTickets: { hydrate: (value) => new SupportTicket(value), sensitive: true },
  saasPlans: { hydrate: (value) => new SaasPlan(value) },
  tenantSubscriptions: { hydrate: (value) => new OperationalRecord(value), sensitive: true },
  backupConfigurations: { hydrate: (value) => new OperationalRecord(value), sensitive: true },
  backupOperations: { hydrate: (value) => new OperationalRecord(value), sensitive: true },
  aiAssistanceRequests: { hydrate: (value) => new OperationalRecord(value), sensitive: true },
  incidents: { hydrate: (value) => new OperationalRecord(value) },
  syncJournal: { hydrate: (value) => new OperationalRecord(value), sensitive: true },
  importBatches: { hydrate: (value) => ({ ...value }), sensitive: true },
  events: { hydrate: (value) => new DomainEvent(value), isArray: true }
};

const RESOURCE_TO_COLLECTION = {
  organizations: 'organizations',
  people: 'people',
  accounts: 'accounts',
  learners: 'learners',
  academicYears: 'academicYears',
  programs: 'programs',
  classes: 'classes',
  enrollments: 'enrollments',
  documents: 'documents',
  credentials: 'credentials',
  documentTemplates: 'documentTemplates',
  documentShares: 'documentShares',
  tenantBranding: 'tenantBranding',
  managedSignatures: 'managedSignatures',
  consents: 'consents',
  collaborationRequests: 'collaborationRequests',
  transfers: 'transfers',
  fees: 'fees',
  invoices: 'invoices',
  payments: 'payments',
  reportCards: 'reportCards',
  threads: 'threads',
  messages: 'messages',
  disciplineRecords: 'disciplineRecords',
  calendarEvents: 'calendarEvents',
  platformSubscriptions: 'platformSubscriptions',
  grades: 'grades',
  gradingSystems: 'gradingSystems',
  attendance: 'attendance',
  assignments: 'assignments',
  assignmentSubmissions: 'assignmentSubmissions',
  customDomains: 'customDomains',
  domainTldCatalog: 'domainTldCatalog',
  domainQuotes: 'domainQuotes',
  domainOrders: 'domainOrders',
  domainLifecycleEvents: 'domainLifecycleEvents',
  scheduleEntries: 'scheduleEntries',
  notifications: 'notifications',
  virtualSchools: 'virtualSchools',
  paidTrainings: 'paidTrainings',
  certificates: 'certificates',
  parentalConsents: 'parentalConsents',
  localizationProfiles: 'localizationProfiles',
  reports: 'reportCards',
  communicationsThreads: 'threads',
  communicationsMessages: 'messages',
  discipline: 'disciplineRecords',
  calendar: 'calendarEvents',
  subscriptions: 'platformSubscriptions',
  financeFees: 'fees',
  financeInvoices: 'invoices',
  financePayments: 'payments'
  ,
  campuses: 'campuses',
  operatingAuthorizations: 'operatingAuthorizations',
  accreditations: 'accreditations',
  institutionVerifications: 'institutionVerifications',
  guardianProfiles: 'guardianProfiles',
  professionalProfiles: 'professionalProfiles',
  guardianLearnerRelations: 'guardianLearnerRelations',
  professionalAssignments: 'professionalAssignments',
  academicPeriods: 'academicPeriods',
  academicLevels: 'academicLevels',
  subjects: 'subjects',
  courses: 'courses',
  learnerLifecycleEvents: 'learnerLifecycleEvents',
  contextualPermissionRules: 'contextualPermissionRules',
  lmsCatalogs: 'lmsCatalogs',
  lmsPrograms: 'lmsPrograms',
  lmsCourses: 'lmsCourses',
  lmsModules: 'lmsModules',
  lmsLessons: 'lmsLessons',
  lmsResources: 'lmsResources',
  lmsParticipants: 'lmsParticipants',
  lmsEnrollments: 'lmsEnrollments',
  lmsProgress: 'lmsProgress',
  lmsQuizzes: 'lmsQuizzes',
  lmsQuestions: 'lmsQuestions',
  lmsAttempts: 'lmsAttempts',
  lmsAssessments: 'lmsAssessments',
  lmsPayments: 'lmsPayments',
  lmsCertificates: 'lmsCertificates',
  meetingProviders: 'meetingProviders',
  meetings: 'meetings',
  meetingParticipants: 'meetingParticipants',
  meetingAttendance: 'meetingAttendance',
  dataQualityRules: 'dataQualityRules',
  dataQualityRuns: 'dataQualityRuns',
  dataQualityIssues: 'dataQualityIssues',
  emisProfiles: 'emisProfiles',
  emisMappings: 'emisMappings',
  emisNationalReferences: 'emisNationalReferences',
  emisExchanges: 'emisExchanges',
  referenceEntries: 'referenceEntries',
  userLocalizationProfiles: 'userLocalizationProfiles',
  analyticsConfigurations: 'analyticsConfigurations',
  supportTickets: 'supportTickets',
  saasPlans: 'saasPlans',
  tenantSubscriptions: 'tenantSubscriptions',
  backupConfigurations: 'backupConfigurations',
  backupOperations: 'backupOperations',
  aiAssistanceRequests: 'aiAssistanceRequests',
  incidents: 'incidents',
  syncJournal: 'syncJournal',
  importBatches: 'importBatches'
};

const RESOURCE_ORGANIZATION_RESOLVER = {
  organizations: (record) => [record.id],
  people: (record) => [record.primaryOrganizationId ?? null],
  accounts: (record) => Array.isArray(record.organizationIds) ? record.organizationIds : [record.organizationId ?? null],
  collaborationRequests: (record) => [record.sourceOrganizationId, record.destinationOrganizationId],
  transfers: (record) => [record.sourceOrganizationId, record.destinationOrganizationId],
  default: (record) => [record.organizationId ?? null]
};

const TENANT_ADMIN_PERMISSIONS = Object.freeze([
  'organizations.read', 'organizations.write',
  'people.read', 'people.write',
  'accounts.read', 'accounts.write',
  'academics.read', 'academics.write',
  'reports.read', 'reports.write',
  'communications.read', 'communications.write',
  'discipline.read', 'discipline.write',
  'calendar.read', 'calendar.write',
  'subscriptions.read', 'subscriptions.write',
  'documents.read', 'documents.write',
  'documents.verify',
  'credentials.read', 'credentials.write',
  'collaboration.read', 'collaboration.write',
  'transfers.read', 'transfers.write',
  'consents.read', 'consents.write',
  'assignments.read', 'assignments.write',
  'grading.read', 'grading.write',
  'attendance.read', 'attendance.write',
  'scheduling.read', 'scheduling.write',
  'finance.read', 'finance.write',
  'notifications.read', 'notifications.write',
  'virtual-schools.read', 'virtual-schools.write',
  'certificates.read', 'certificates.write',
  'i18n.read', 'i18n.write',
  'security.read', 'security.write',
  'institution.read', 'institution.write', 'institution.verify',
  'profiles.read', 'profiles.write',
  'lifecycle.read', 'lifecycle.write',
  'authorization-matrix.read', 'authorization-matrix.write',
  'lms.read', 'lms.write',
  'meetings.read', 'meetings.write',
  'data-quality.read', 'data-quality.write',
  'emis.read', 'emis.write',
  'references.read', 'references.write',
  'analytics.read', 'analytics.write', 'analytics.export',
  'support.read', 'support.write',
  'saas.read', 'saas.write',
  'operations.read', 'operations.write',
  'ai-assistance.read', 'ai-assistance.write',
  'audit.read'
]);

const PREVIEW_ACCOUNT_ROLES = Object.freeze({
  learner: Object.freeze(['assignments.read', 'grading.self', 'lms.read']),
  student: Object.freeze(['calendar.read', 'grading.read', 'lms.read']),
  teacher: Object.freeze([
    'assignments.read', 'assignments.write',
    'attendance.read', 'attendance.write',
    'grading.read', 'grading.write',
    'lms.read', 'scheduling.read'
  ]),
  'platform-admin': Object.freeze(['audit.read', 'operations.read'])
});

function createPreviewTemporaryPassword() {
  return `Edu!${randomBytes(24).toString('base64url')}9a`;
}

function samePermissions(left, right) {
  return left.length === right.length && left.every((permission) => right.includes(permission));
}

function normalizePaging({ limit = 25, offset = 0 } = {}) {
  return {
    limit: Math.max(1, Math.min(200, Number(limit) || 25)),
    offset: Math.max(0, Number(offset) || 0)
  };
}

function matchesFilterValue(recordValue, filterValue) {
  if (Array.isArray(recordValue)) {
    return recordValue.some((entry) => matchesFilterValue(entry, filterValue));
  }

  if (recordValue === undefined || recordValue === null) {
    return false;
  }

  return String(recordValue) === String(filterValue);
}

function cloneRecord(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function hydrateValue(definition, value) {
  const hydrated = definition.hydrate(value);
  if (hydrated && typeof hydrated === 'object') {
    Object.assign(hydrated, value);
  }
  return hydrated;
}

function upsertMapValue(map, value, keySelector = (item) => item.id) {
  map.set(keySelector(value), value);
  return value;
}

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export class PersistentEducationPlatformService extends EducationPlatformService {
  constructor(options = {}) {
    super(options);
    this.connection = options.connection ?? createDatabaseConnection({ url: options.databaseUrl });
    this.domainVerifier = options.domainVerifier ?? verifyDomainTxt;
    this.domainProvider = options.domainProvider ?? createDomainProvider(options);
    this.repositories = Object.fromEntries(
      Object.entries(COLLECTIONS).map(([collectionKey, definition]) => {
        const repository = definition.repository?.(this.connection)
          ?? createCollectionRepository(this.connection, {
            collectionKey,
            keyField: definition.keyField ?? 'id',
            sensitive: definition.sensitive ?? false
          });
        return [collectionKey, repository];
      })
    );

    if (!options.deferHydration) {
      this.hydrateState();
    }
  }

  hydrateState() {
    if (this.connection.isAsync) {
      return Promise.all(
        Object.entries(COLLECTIONS).map(async ([collectionKey, definition]) => {
          const storedValues = await this.repositories[collectionKey].loadAll();
          const values = storedValues.map((value) => hydrateValue(definition, value));
          if (definition.isArray) {
            this[collectionKey] = values;
            return;
          }
          const keySelector = definition.keySelector ?? ((value) => value.id);
          this[collectionKey] = new Map(values.map((value) => [keySelector(value), value]));
        })
      ).then(() => {
        this.seedStandardReferences();
        return this;
      });
    }

    for (const [collectionKey, definition] of Object.entries(COLLECTIONS)) {
      const values = this.repositories[collectionKey].loadAll().map((value) => hydrateValue(definition, value));
      if (definition.isArray) {
        this[collectionKey] = values;
        continue;
      }

      const keySelector = definition.keySelector ?? ((value) => value.id);
      this[collectionKey] = new Map(values.map((value) => [keySelector(value), value]));
    }
    this.seedStandardReferences();
    return this;
  }

  transactional(callback) {
    return this.connection.transaction(() => callback());
  }

  persistRecord(collectionKey, record, { actorId = null, action = 'upsert' } = {}) {
    const normalizedRecord = record;
    if (collectionKey === 'organizations' && !normalizedRecord.organizationId) {
      normalizedRecord.organizationId = normalizedRecord.id;
    } else if (collectionKey === 'people' && !normalizedRecord.organizationId) {
      normalizedRecord.organizationId = normalizedRecord.primaryOrganizationId ?? null;
    } else if (collectionKey === 'accounts' && !normalizedRecord.organizationId) {
      normalizedRecord.organizationId = normalizedRecord.organizationIds?.[0] ?? null;
    }

    const persistence = this.repositories[collectionKey].upsert(normalizedRecord, { actorId, action });
    if (collectionKey === 'localizationProfiles') {
      upsertMapValue(this.localizationProfiles, normalizedRecord, (value) => value.organizationId);
      return persistence;
    }

    if (collectionKey === 'events') {
      return persistence;
    }

    upsertMapValue(this[collectionKey], normalizedRecord);
    return persistence;
  }

  recordEvent(type, subject, actorId = null, payload = {}, options = {}) {
    const event = FoundationService.prototype.recordEvent.call(this, type, subject, actorId, payload, options);
    this.repositories.events.upsert(event, { actorId, action: type });
    return event;
  }

  writeAuditEntry({
    actorId = null,
    organizationId = null,
    entityType,
    entityId,
    action,
    before = null,
    after = null,
    context = {},
    reason = null
  }) {
    return this.connection.run(
      `INSERT INTO audit_trail(
         id, organization_id, actor_id, entity_type, entity_id, action,
         before_payload, after_payload, context_payload, reason, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createPermanentId(),
        organizationId,
        actorId,
        entityType,
        entityId,
        action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        JSON.stringify(context ?? {}),
        reason,
        new Date().toISOString()
      ]
    );
  }

  recordCreate(collectionKey, record, actorId, action) {
    this.persistRecord(collectionKey, record, { actorId, action });
    this.writeAuditEntry({
      actorId,
      organizationId: record.organizationId ?? null,
      entityType: record.constructor?.name ?? collectionKey,
      entityId: record.id,
      action,
      before: null,
      after: cloneRecord(record)
    });
    return record;
  }

  recordUpdate(collectionKey, before, after, actorId, action, { context = {}, reason = null } = {}) {
    const persistence = this.persistRecord(collectionKey, after, { actorId, action });
    const audit = this.writeAuditEntry({
      actorId,
      organizationId: after.organizationId ?? before?.organizationId ?? null,
      entityType: after.constructor?.name ?? collectionKey,
      entityId: after.id,
      action,
      before,
      after: cloneRecord(after),
      context,
      reason
    });
    if (persistence instanceof Promise || audit instanceof Promise) {
      return Promise.all([persistence, audit]).then(() => after);
    }
    return after;
  }

  createOrganization(input, actorId = null) {
    return this.transactional(() => this.recordCreate('organizations', super.createOrganization(input, actorId), actorId, 'organization.create'));
  }

  registerPerson(input, actorId = null) {
    return this.transactional(() => this.recordCreate('people', super.registerPerson(input, actorId), actorId, 'person.create'));
  }

  openUserAccount(input, actorId = null) {
    return this.transactional(() => {
      const account = super.openUserAccount(input, actorId);
      if (input.password) {
        account.activate();
      }
      this.recordCreate('accounts', account, actorId, 'account.create');
      if (input.password) {
        this.setLocalPassword(account.id, input.password);
      }
      return account;
    });
  }

  createPermission(input, actorId = null) {
    return this.transactional(() => this.recordCreate('permissions', super.createPermission(input, actorId), actorId, 'permission.create'));
  }

  createRole(input, actorId = null) {
    return this.transactional(() => this.recordCreate('roles', super.createRole(input, actorId), actorId, 'role.create'));
  }

  assignRole(input, actorId = null) {
    return this.transactional(() => this.recordCreate('roleAssignments', super.assignRole(input, actorId), actorId, 'role-assignment.create'));
  }

  createPermissionGrant(input, actorId = null) {
    return this.transactional(() => this.recordCreate('permissionGrants', super.createPermissionGrant(input, actorId), actorId, 'permission-grant.create'));
  }

  createLearner(input, actorId = null) {
    return this.transactional(() => this.recordCreate('learners', super.createLearner(input, actorId), actorId, 'learner.create'));
  }

  createAcademicYear(input, actorId = null) {
    return this.transactional(() => this.recordCreate('academicYears', super.createAcademicYear(input, actorId), actorId, 'academic-year.create'));
  }

  createProgram(input, actorId = null) {
    return this.transactional(() => this.recordCreate('programs', super.createProgram(input, actorId), actorId, 'program.create'));
  }

  createClass(input, actorId = null) {
    return this.transactional(() => this.recordCreate('classes', super.createClass(input, actorId), actorId, 'class.create'));
  }

  createEnrollment(input, actorId = null) {
    return this.transactional(() => this.recordCreate('enrollments', super.createEnrollment(input, actorId), actorId, 'enrollment.create'));
  }

  createInstitutionalRecord(collectionKey, create, actorId, action) {
    return this.transactional(() => this.recordCreate(collectionKey, create(), actorId, action));
  }

  createCampus(input, actorId = null) {
    return this.createInstitutionalRecord('campuses', () => super.createCampus(input, actorId), actorId, 'campus.create');
  }

  createOperatingAuthorization(input, actorId = null) {
    return this.createInstitutionalRecord('operatingAuthorizations', () => super.createOperatingAuthorization(input, actorId), actorId, 'operating-authorization.create');
  }

  createAccreditation(input, actorId = null) {
    return this.createInstitutionalRecord('accreditations', () => super.createAccreditation(input, actorId), actorId, 'accreditation.create');
  }

  createInstitutionVerification(input, actorId = null) {
    return this.createInstitutionalRecord('institutionVerifications', () => super.createInstitutionVerification(input, actorId), actorId, 'institution-verification.create');
  }

  createGuardianProfile(input, actorId = null) {
    return this.createInstitutionalRecord('guardianProfiles', () => super.createGuardianProfile(input, actorId), actorId, 'guardian-profile.create');
  }

  createProfessionalProfile(input, actorId = null) {
    return this.createInstitutionalRecord('professionalProfiles', () => super.createProfessionalProfile(input, actorId), actorId, 'professional-profile.create');
  }

  createGuardianLearnerRelation(input, actorId = null) {
    return this.createInstitutionalRecord('guardianLearnerRelations', () => super.createGuardianLearnerRelation(input, actorId), actorId, 'guardian-learner-relation.create');
  }

  createProfessionalAssignment(input, actorId = null) {
    return this.createInstitutionalRecord('professionalAssignments', () => super.createProfessionalAssignment(input, actorId), actorId, 'professional-assignment.create');
  }

  createAcademicPeriod(input, actorId = null) {
    return this.createInstitutionalRecord('academicPeriods', () => super.createAcademicPeriod(input, actorId), actorId, 'academic-period.create');
  }

  createAcademicLevel(input, actorId = null) {
    return this.createInstitutionalRecord('academicLevels', () => super.createAcademicLevel(input, actorId), actorId, 'academic-level.create');
  }

  createSubject(input, actorId = null) {
    return this.createInstitutionalRecord('subjects', () => super.createSubject(input, actorId), actorId, 'subject.create');
  }

  createCourse(input, actorId = null) {
    return this.createInstitutionalRecord('courses', () => super.createCourse(input, actorId), actorId, 'course.create');
  }

  recordLearnerLifecycleEvent(input, actorId = null) {
    return this.transactional(() => {
      const learnerBefore = cloneRecord(this.learners.get(input.learnerId));
      const event = EducationPlatformService.prototype.recordLearnerLifecycleEvent.call(this, input, actorId);
      this.recordCreate('learnerLifecycleEvents', event, actorId, `learner-lifecycle.${event.eventType}`);
      this.recordUpdate('learners', learnerBefore, this.learners.get(input.learnerId), actorId, `learner.${event.eventType}`);
      return event;
    });
  }

  createContextualPermissionRule(input, actorId = null) {
    return this.createInstitutionalRecord('contextualPermissionRules', () => super.createContextualPermissionRule(input, actorId), actorId, 'contextual-permission-rule.create');
  }

  createPlatformRecord(resource, input, actorId = null) {
    return this.transactional(() => {
      const record = super.createPlatformRecord(resource, input, actorId);
      return this.recordCreate(resource, record, actorId, `${resource}.create`);
    });
  }

  submitLmsQuizAttempt(input, actorId = null) {
    return super.submitLmsQuizAttempt(input, actorId);
  }

  async runDataQuality(input, actorId = null) {
    const run = await super.runDataQuality(input, actorId);
    await this.persistRecord('dataQualityRuns', run, { actorId, action: 'dataQualityRuns.complete' });
    return run;
  }

  async transitionDataQualityIssue(issueId, transition, input = {}, actorId = null) {
    const issue = this.dataQualityIssues.get(issueId);
    if (transition === 'correct' && input.correction && issue) {
      await this.updateCrudResource(issue.targetResource, issue.targetId, input.correction, actorId);
    }
    return this.transactional(() => {
      const before = cloneRecord(issue);
      const updated = super.transitionDataQualityIssue(issueId, transition, input, actorId);
      return this.recordUpdate('dataQualityIssues', before, updated, actorId, `data-quality.issue.${transition}`);
    });
  }

  async importMeetingAttendance(meetingId, actorId = null) {
    const before = cloneRecord(this.meetings.get(meetingId));
    const result = await super.importMeetingAttendance(meetingId, actorId);
    const meeting = this.meetings.get(meetingId);
    await this.transactional(() =>
      this.recordUpdate('meetings', before, meeting, actorId, `meeting.attendance.${result.state}`)
    );
    return result;
  }

  correctEmisExchange(exchangeId, input, actorId = null) {
    const before = cloneRecord(this.emisExchanges.get(exchangeId));
    const exchange = super.correctEmisExchange(exchangeId, input, actorId);
    return this.transactional(() =>
      this.recordUpdate('emisExchanges', before, exchange, actorId, 'emis.exchange.corrected')
    );
  }

  async transmitEmisExchange(exchangeId, actorId = null, options = {}) {
    const before = cloneRecord(this.emisExchanges.get(exchangeId));
    const exchange = await super.transmitEmisExchange(exchangeId, actorId, options);
    return this.transactional(() =>
      this.recordUpdate('emisExchanges', before, exchange, actorId, `emis.exchange.${exchange.exchangeState}`)
    );
  }

  acknowledgeEmisExchange(exchangeId, input, actorId = null) {
    const before = cloneRecord(this.emisExchanges.get(exchangeId));
    const exchange = super.acknowledgeEmisExchange(exchangeId, input, actorId);
    return this.transactional(() =>
      this.recordUpdate('emisExchanges', before, exchange, actorId, `emis.exchange.${exchange.exchangeState}`)
    );
  }

  registerDocument(input, actorId = null) {
    return this.transactional(() => this.recordCreate('documents', super.registerDocument(input, actorId), actorId, 'document.create'));
  }

  saveTenantLogo(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const asset = validateAsset(input, 'logo');
    const id = `branding:${input.organizationId}`;
    const before = cloneRecord(this.tenantBranding.get(id));
    const previousAssetId = before?.assetId ?? null;
    const assetId = createPermanentId();
    const branding = createAssetRecord({
      id,
      organizationId: input.organizationId,
      assetId,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      byteLength: asset.byteLength,
      sha256: asset.sha256,
      dimensions: asset.dimensions,
      altText: String(input.altText ?? 'Institution logo').trim() || 'Institution logo',
      updatedBy: actorId
    });
    return this.transactional(() => {
      saveBlob(this, { assetId, organizationId: input.organizationId, asset, actorId });
      if (previousAssetId) deleteBlob(this, previousAssetId, input.organizationId);
      return before
        ? this.recordUpdate('tenantBranding', before, branding, actorId, 'tenant-branding.replace')
        : this.recordCreate('tenantBranding', branding, actorId, 'tenant-branding.create');
    });
  }

  getTenantLogo(organizationId) {
    this.assertOrganizationContext(organizationId);
    const branding = this.tenantBranding.get(`branding:${organizationId}`) ?? null;
    return branding?.status === 'archived' ? null : branding;
  }

  async getTenantLogoContent(organizationId) {
    const branding = this.getTenantLogo(organizationId);
    if (!branding) throw new ValidationError('No logo is configured for this organization.');
    return readBlob(this, branding.assetId, organizationId);
  }

  removeTenantLogo(organizationId, actorId = null) {
    const branding = this.getTenantLogo(organizationId);
    if (!branding) return false;
    return this.transactional(() => {
      deleteBlob(this, branding.assetId, organizationId);
      const before = cloneRecord(branding);
      branding.assetId = null;
      branding.status = 'archived';
      branding.archivedAt = new Date();
      branding.touch();
      this.recordUpdate('tenantBranding', before, branding, actorId, 'tenant-branding.remove');
      return true;
    });
  }

  createManagedSignature(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    if (this.listManagedSignatures(input.organizationId).filter((signature) => signature.status !== 'archived').length >= 100) {
      throw new ValidationError('The organization has reached the limit of 100 managed signatures.');
    }
    const person = this.assertTenantRecord(this.people, input.personId, input.organizationId, 'signatory');
    const purpose = String(input.purpose ?? '').trim();
    if (!purpose) throw new ValidationError('purpose is required.');
    const signatureType = input.signatureType ?? 'visual';
    if (signatureType !== 'visual') {
      throw new ValidationError('Only visual signature images are supported; no qualified electronic signature is claimed.');
    }
    const asset = validateAsset(input, 'signature');
    const signature = createAssetRecord({
      organizationId: input.organizationId,
      personId: person.id,
      holderName: `${person.givenName} ${person.familyName}`.trim(),
      function: String(input.function ?? '').trim(),
      purpose,
      signatureType,
      assetId: createPermanentId(),
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      byteLength: asset.byteLength,
      sha256: asset.sha256,
      dimensions: asset.dimensions,
      active: input.active !== false,
      activatedAt: input.active === false ? null : new Date().toISOString(),
      revokedAt: null,
      revocationReason: null,
      legalAssurance: 'visual-mark-only'
    });
    if (!signature.function) throw new ValidationError('function is required.');
    return this.transactional(() => {
      saveBlob(this, { assetId: signature.assetId, organizationId: signature.organizationId, asset, actorId });
      return this.recordCreate('managedSignatures', signature, actorId, 'managed-signature.create');
    });
  }

  revokeManagedSignature(signatureId, organizationId, input, actorId = null) {
    const signature = this.assertTenantRecord(this.managedSignatures, signatureId, organizationId, 'signature');
    if (!input.reason) throw new ValidationError('reason is required to revoke a signature.');
    return this.transactional(() => {
      const before = cloneRecord(signature);
      signature.active = false;
      signature.revokedAt = new Date().toISOString();
      signature.revocationReason = String(input.reason);
      signature.touch();
      return this.recordUpdate('managedSignatures', before, signature, actorId, 'managed-signature.revoke', {
        reason: input.reason
      });
    });
  }

  listManagedSignatures(organizationId, personId = null) {
    return Array.from(this.managedSignatures.values()).filter((signature) =>
      signature.organizationId === organizationId && (!personId || signature.personId === personId)
    );
  }

  async getManagedSignatureContent(signatureId, organizationId) {
    const signature = this.assertTenantRecord(this.managedSignatures, signatureId, organizationId, 'signature');
    return readBlob(this, signature.assetId, organizationId);
  }

  uploadEvidenceDocument(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    if (Array.from(this.documents.values()).filter((document) =>
      document.organizationId === input.organizationId && document.metadata?.source === 'evidence-upload'
      && document.status !== 'archived'
    ).length >= 1000) {
      throw new ValidationError('The organization has reached the limit of 1,000 active evidence files.');
    }
    const person = this.assertTenantRecord(this.people, input.personId, input.organizationId, 'person');
    const type = assertEvidenceType(input.type);
    const asset = validateAsset(input, 'evidence');
    const links = {};
    for (const [field, collection] of [
      ['enrollmentId', 'enrollments'],
      ['paymentId', 'payments'],
      ['resultId', 'grades'],
      ['credentialId', 'credentials']
    ]) {
      if (input[field]) {
        this.assertTenantRecord(this[collection], input[field], input.organizationId, field);
        links[field] = input[field];
      }
    }
    const documentId = createPermanentId();
    return this.transactional(() => {
      const document = FoundationService.prototype.registerDocument.call(this, {
        id: documentId,
        organizationId: input.organizationId,
        personId: person.id,
        type,
        title: String(input.title ?? asset.fileName),
        storageReference: `db://secure-assets/${documentId}`,
        fileHash: asset.sha256,
        accessLevel: input.accessLevel ?? 'holder',
        metadata: {
          source: 'evidence-upload',
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          byteLength: asset.byteLength,
          dimensions: asset.dimensions,
          links,
          verification: {
            status: 'pending',
            submittedBy: actorId,
            submittedAt: new Date().toISOString(),
            verifiedBy: null,
            verifiedAt: null,
            reason: null
          }
        }
      }, actorId);
      this.recordCreate('documents', document, actorId, 'evidence.upload');
      saveBlob(this, { assetId: documentId, organizationId: input.organizationId, asset, actorId });
      return document;
    });
  }

  async getEvidenceContent(documentId, organizationId) {
    const document = this.assertTenantRecord(this.documents, documentId, organizationId, 'document');
    if (document.metadata?.source !== 'evidence-upload') throw new ValidationError('Document has no uploaded evidence content.');
    return readBlob(this, document.id, organizationId);
  }

  verifyEvidenceDocument(documentId, organizationId, input, actorId = null) {
    const document = this.assertTenantRecord(this.documents, documentId, organizationId, 'document');
    if (document.metadata?.source !== 'evidence-upload') throw new ValidationError('Document is not uploaded evidence.');
    const status = String(input.status ?? '');
    if (!['verified', 'rejected', 'expired'].includes(status)) {
      throw new ValidationError('status must be verified, rejected, or expired.');
    }
    if (status === 'rejected' && !input.reason) throw new ValidationError('reason is required when evidence is rejected.');
    return this.transactional(() => {
      const before = cloneRecord(document);
      document.metadata = {
        ...document.metadata,
        verification: {
          ...document.metadata.verification,
          status,
          verifiedBy: actorId,
          verifiedAt: new Date().toISOString(),
          reason: input.reason ?? null
        }
      };
      document.touch();
      return this.recordUpdate('documents', before, document, actorId, `evidence.${status}`, {
        reason: input.reason ?? null
      });
    });
  }

  getPersonProfile(personId, organizationId, { includePrivate = false } = {}) {
    const person = this.assertTenantRecord(this.people, personId, organizationId, 'person');
    const roleIds = new Set(Array.from(this.roleAssignments.values())
      .filter((assignment) => assignment.personId === person.id && assignment.organizationId === organizationId && !assignment.endsAt)
      .map((assignment) => assignment.roleId));
    const profile = person.metadata?.profile ?? {};
    return {
      id: person.id,
      organizationId,
      givenName: person.givenName,
      familyName: person.familyName,
      preferredName: person.preferredName,
      birthDate: includePrivate ? person.birthDate : null,
      countryOfCitizenship: person.countryOfCitizenship,
      preferredLocale: person.preferredLocale,
      contacts: includePrivate ? person.contacts : person.contacts.map((contact) => ({
        type: contact.type,
        value: '[masked]',
        isPrimary: contact.isPrimary,
        verifiedAt: contact.verifiedAt
      })),
      address: profile.address ?? null,
      countryCode: profile.countryCode ?? person.countryOfCitizenship ?? null,
      timezone: profile.timezone ?? null,
      accessibility: profile.accessibility ?? {},
      notifications: profile.notifications ?? {},
      bio: profile.bio ?? null,
      emergencyContact: includePrivate ? (profile.emergencyContact ?? null) : null,
      privacyConsent: Boolean(profile.privacyConsent),
      avatar: profile.avatar ?? null,
      roles: Array.from(roleIds).map((roleId) => {
        const role = this.roles.get(roleId);
        return { id: roleId, name: role?.name ?? role?.code ?? 'Assigned role' };
      }),
      professionalAssignments: Array.from(this.professionalAssignments.values())
        .filter((assignment) => assignment.personId === person.id && assignment.organizationId === organizationId)
        .map((assignment) => ({ id: assignment.id, roleTitle: assignment.roleTitle, campusId: assignment.campusId ?? null }))
    };
  }

  updatePersonProfile(personId, organizationId, input, { selfService = false, actorId = null } = {}) {
    const person = this.assertTenantRecord(this.people, personId, organizationId, 'person');
    if (person.status === 'archived') throw new ValidationError('Archived person profiles cannot be changed.');
    const selfFields = new Set([
      'preferredName', 'preferredLocale', 'contacts', 'address', 'countryCode', 'timezone',
      'accessibility', 'notifications', 'bio', 'emergencyContact', 'privacyConsent'
    ]);
    const adminFields = new Set([...selfFields, 'givenName', 'familyName', 'birthDate', 'countryOfCitizenship']);
    const allowed = selfService ? selfFields : adminFields;
    const forbidden = Object.keys(input).filter((key) => !allowed.has(key));
    if (forbidden.length) throw new ValidationError(`Profile fields cannot be changed here: ${forbidden.join(', ')}.`);
    if (input.preferredLocale && !['fr', 'en', 'es', 'pt', 'ar'].includes(input.preferredLocale)) {
      throw new ValidationError('preferredLocale must be fr, en, es, pt, or ar.');
    }
    if (input.countryCode && !/^[A-Z]{2}$/.test(String(input.countryCode).toUpperCase())) {
      throw new ValidationError('countryCode must be an ISO alpha-2 code.');
    }
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: input.timezone });
      } catch {
        throw new ValidationError('timezone must be a valid IANA timezone.');
      }
    }
    if (input.privacyConsent === false) {
      input = { ...input, emergencyContact: null };
    }
    if (input.emergencyContact && input.privacyConsent !== true && person.metadata?.profile?.privacyConsent !== true) {
      throw new ValidationError('privacyConsent is required before storing an emergency contact.');
    }
    const before = cloneRecord(person);
    const profile = {
      ...(person.metadata?.profile ?? {}),
      ...Object.fromEntries(Object.entries(input).filter(([key]) =>
        ['address', 'countryCode', 'timezone', 'accessibility', 'notifications', 'bio', 'emergencyContact', 'privacyConsent'].includes(key)
      ))
    };
    if (typeof profile.bio === 'string' && profile.bio.length > 2000) throw new ValidationError('bio cannot exceed 2,000 characters.');
    if (typeof profile.address === 'string' && profile.address.length > 500) throw new ValidationError('address cannot exceed 500 characters.');
    if (typeof input.preferredName === 'string' && input.preferredName.length > 120) {
      throw new ValidationError('preferredName cannot exceed 120 characters.');
    }
    if (selfService && Array.isArray(input.contacts)) {
      input = {
        ...input,
        contacts: input.contacts.map(({ type, value, isPrimary }) => ({ type, value, isPrimary }))
      };
    }
    if (input.countryCode) profile.countryCode = String(input.countryCode).toUpperCase();
    if (Object.hasOwn(input, 'privacyConsent')) profile.consentUpdatedAt = new Date().toISOString();
    const candidate = new Person({
      ...person,
      ...Object.fromEntries(Object.entries(input).filter(([key]) =>
        ['givenName', 'familyName', 'birthDate', 'countryOfCitizenship', 'preferredName', 'preferredLocale', 'contacts'].includes(key)
      )),
      metadata: { ...person.metadata, profile }
    });
    for (const field of ['givenName', 'familyName', 'birthDate', 'countryOfCitizenship', 'preferredName', 'preferredLocale', 'contacts', 'metadata']) {
      person[field] = candidate[field];
    }
    person.touch();
    return this.transactional(() =>
      this.recordUpdate('people', before, person, actorId, selfService ? 'profile.self-update' : 'profile.admin-update')
    );
  }

  savePersonAvatar(personId, organizationId, input, actorId = null) {
    const person = this.assertTenantRecord(this.people, personId, organizationId, 'person');
    const asset = validateAsset(input, 'avatar');
    const previousAssetId = person.metadata?.profile?.avatar?.assetId ?? null;
    const assetId = createPermanentId();
    const before = cloneRecord(person);
    person.metadata = {
      ...person.metadata,
      profile: {
        ...(person.metadata?.profile ?? {}),
        avatar: {
          assetId,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          byteLength: asset.byteLength,
          sha256: asset.sha256,
          dimensions: asset.dimensions
        }
      }
    };
    person.touch();
    return this.transactional(() => {
      saveBlob(this, { assetId, organizationId, asset, actorId });
      if (previousAssetId) deleteBlob(this, previousAssetId, organizationId);
      this.recordUpdate('people', before, person, actorId, 'profile.avatar.replace');
      return person.metadata.profile.avatar;
    });
  }

  async getPersonAvatar(personId, organizationId) {
    const person = this.assertTenantRecord(this.people, personId, organizationId, 'person');
    const assetId = person.metadata?.profile?.avatar?.assetId;
    if (!assetId) throw new ValidationError('No avatar is configured for this person.');
    return readBlob(this, assetId, organizationId);
  }

  registerDocumentVersion(previousDocumentId, input = {}, actorId = null) {
    return this.transactional(() => {
      const previous = cloneRecord(this.documents.get(previousDocumentId));
      const document = super.registerDocumentVersion(previousDocumentId, input, actorId);
      this.recordUpdate('documents', previous, this.documents.get(previousDocumentId), actorId, 'document.supersede');
      return this.recordCreate('documents', document, actorId, 'document.version');
    });
  }

  transitionDocumentStatus(documentId, input, actorId = null) {
    const document = this.documents.get(documentId);
    if (!document) throw new ValidationError(`Unknown document: ${documentId}`);
    const allowed = { active: ['expired', 'archived'], expired: ['archived'], archived: [], superseded: ['archived'] };
    if (!(allowed[document.status] ?? []).includes(input.status)) {
      throw new ValidationError(`Transition from ${document.status} to ${input.status} is not allowed.`);
    }
    if (!input.reason) throw new ValidationError('reason is required for a document transition.');
    return this.transactional(() => {
      const before = cloneRecord(document);
      document.status = input.status;
      if (input.status === 'archived') document.archivedAt = new Date();
      document.touch();
      this.recordEvent(`document.${input.status}`, document, actorId, { reason: input.reason });
      return this.recordUpdate('documents', before, document, actorId, `document.${input.status}`, {
        reason: input.reason
      });
    });
  }

  pseudonymizeDocument(documentId, input, actorId = null) {
    const document = this.documents.get(documentId);
    if (!document) throw new ValidationError(`Unknown document: ${documentId}`);
    if (!input.reason) throw new ValidationError('reason is required for pseudonymization.');
    const fields = Array.isArray(input.metadataFields) ? input.metadataFields : [];
    return this.transactional(() => {
      const before = cloneRecord(document);
      const metadata = { ...document.metadata };
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(metadata, field)) metadata[field] = '[pseudonymized]';
      }
      document.metadata = metadata;
      document.pseudonymizedAt = new Date().toISOString();
      document.pseudonymizationReason = input.reason;
      document.touch();
      this.recordEvent('document.pseudonymized', document, actorId, {
        reason: input.reason,
        fields
      });
      return this.recordUpdate('documents', before, document, actorId, 'document.pseudonymize', {
        context: { fields },
        reason: input.reason
      });
    });
  }

  createDocumentTemplate(input, actorId = null) {
    return this.createInstitutionalRecord(
      'documentTemplates',
      () => super.createDocumentTemplate(input, actorId),
      actorId,
      'document-template.create'
    );
  }

  issueCredential(input, actorId = null) {
    return this.transactional(() => {
      let templateSnapshot = input.templateSnapshot ?? {};
      let templateVersion = input.templateVersion ?? null;
      if (input.templateId) {
        const template = this.assertTenantRecord(
          this.documentTemplates,
          input.templateId,
          input.organizationId,
          'document template'
        );
        templateSnapshot = template.snapshot();
        templateVersion = template.versionNumber;
      }
      const credential = super.issueCredential({ ...input, templateSnapshot, templateVersion }, actorId);
      return this.recordCreate('credentials', credential, actorId, 'credential.create');
    });
  }

  issueLmsTitle(input, actorId = null) {
    const enrollment = this.assertTenantRecord(this.lmsEnrollments, input.enrollmentId, input.organizationId, 'LMS enrollment');
    if (enrollment.enrollmentStatus !== 'active') throw new ValidationError('LMS enrollment is not active.');
    const progress = this.getLmsEnrollmentProgress(enrollment.id, input.organizationId);
    if (!progress.eligibleForTitle) {
      throw new ValidationError('All required lessons and final exams must be passed before title issuance.');
    }
    const titleType = String(input.titleType ?? '');
    if (!['certificate', 'attestation', 'diploma'].includes(titleType)) {
      throw new ValidationError('titleType must be certificate, attestation, or diploma.');
    }
    const participant = this.assertTenantRecord(this.lmsParticipants, enrollment.participantId, input.organizationId, 'LMS participant');
    const person = this.assertTenantRecord(this.people, participant.personId, input.organizationId, 'person');
    const program = this.assertTenantRecord(this.lmsPrograms, enrollment.programId, input.organizationId, 'LMS program');
    const existing = Array.from(this.lmsCertificates.values()).find((item) =>
      item.enrollmentId === enrollment.id && item.titleType === titleType && item.status !== 'archived'
    );
    if (existing) {
      const credential = this.credentials.get(existing.credentialId);
      return { credential, certificate: existing, idempotent: true, verificationToken: null };
    }
    if (!Array.isArray(input.signatureIds) || input.signatureIds.length === 0) {
      throw new ValidationError('At least one active managed signature is required for title issuance.');
    }
    const signatures = input.signatureIds.map((signatureId) => {
      const signature = this.assertTenantRecord(this.managedSignatures, signatureId, input.organizationId, 'signature');
      if (!signature.active || signature.revokedAt) throw new ValidationError('Only active, non-revoked signatures can be used.');
      return {
        name: signature.holderName,
        function: signature.function,
        signatureType: 'visual',
        evidenceReference: `managed-signature:${signature.id}:${signature.sha256}`
      };
    });
    const hasAuthority = Array.from(this.accreditations.values()).some((record) =>
      record.organizationId === input.organizationId && record.status === 'active'
    ) || Array.from(this.operatingAuthorizations.values()).some((record) =>
      record.organizationId === input.organizationId && record.status === 'active'
    );
    const awardedAt = new Date().toISOString();
    const generatedSnapshot = {
      titleType,
      holder: { id: person.id, name: `${person.givenName} ${person.familyName}`.trim() },
      program: { id: program.id, title: program.title },
      awardedAt,
      issuerOrganizationId: input.organizationId,
      signatures,
      assurance: hasAuthority ? 'configured-authority-record-present' : 'platform-issued-not-accreditation-verified'
    };
    const fileContent = JSON.stringify(generatedSnapshot);
    return this.transactional(() => {
      const document = FoundationService.prototype.registerDocument.call(this, {
        organizationId: input.organizationId,
        personId: person.id,
        type: titleType,
        title: input.title ?? `${titleType}: ${program.title}`,
        storageReference: `generated://lms/${enrollment.id}/${titleType}`,
        fileContent,
        accessLevel: 'holder',
        issuedAt: awardedAt,
        metadata: {
          source: 'lms-title',
          enrollmentId: enrollment.id,
          lmsProgramId: program.id,
          platformIssued: true,
          authorityVerification: generatedSnapshot.assurance,
          generatedSnapshot
        }
      }, actorId);
      this.recordCreate('documents', document, actorId, 'lms-title.document.create');
      const credential = FoundationService.prototype.issueCredential.call(this, {
        organizationId: input.organizationId,
        personId: person.id,
        documentId: document.id,
        programId: program.academicProgramId,
        credentialType: titleType,
        qualification: input.qualification ?? `${titleType} (platform-issued)`,
        signatories: signatures,
        awardedAt,
        status: 'issued'
      }, actorId);
      this.recordCreate('credentials', credential, actorId, 'lms-title.credential.issue');
      const certificate = EducationPlatformService.prototype.createPlatformRecord.call(this, 'lmsCertificates', {
        organizationId: input.organizationId,
        enrollmentId: enrollment.id,
        credentialId: credential.id,
        titleType,
        issuedAt: awardedAt
      }, actorId);
      this.recordCreate('lmsCertificates', certificate, actorId, 'lms-title.link.create');
      return {
        credential,
        certificate,
        idempotent: false,
        verificationToken: credential.verificationToken
      };
    });
  }

  issueCredentialRevision(previousCredentialId, input = {}, actorId = null) {
    return this.transactional(() => {
      const previous = cloneRecord(this.credentials.get(previousCredentialId));
      let templateSnapshot = input.templateSnapshot;
      let templateVersion = input.templateVersion;
      if (input.templateId) {
        const template = this.assertTenantRecord(
          this.documentTemplates,
          input.templateId,
          previous.organizationId,
          'document template'
        );
        templateSnapshot = template.snapshot();
        templateVersion = template.versionNumber;
      }
      const credential = super.issueCredentialRevision(previousCredentialId, {
        ...input,
        ...(templateSnapshot ? { templateSnapshot, templateVersion } : {})
      }, actorId);
      this.recordUpdate(
        'credentials',
        previous,
        this.credentials.get(previousCredentialId),
        actorId,
        `credential.${this.credentials.get(previousCredentialId).status}`,
        { reason: input.reason ?? input.replacementReason ?? null }
      );
      return this.recordCreate('credentials', credential, actorId, 'credential.version');
    });
  }

  transitionCredentialStatus(credentialId, input, actorId = null) {
    return this.transactional(() => {
      const before = cloneRecord(this.credentials.get(credentialId));
      const credential = super.transitionCredentialStatus(credentialId, input, actorId);
      return this.recordUpdate(
        'credentials',
        before,
        credential,
        actorId,
        `credential.transition.${credential.status}`,
        {
          context: { authority: input.authority ?? null },
          reason: input.reason
        }
      );
    });
  }

  recordConsent(input, actorId = null) {
    return this.createInstitutionalRecord(
      'consents',
      () => super.recordConsent(input, actorId),
      actorId,
      'consent.create'
    );
  }

  withdrawConsent(consentId, input, actorId = null) {
    const consent = this.consents.get(consentId);
    if (!consent) throw new ValidationError(`Unknown consent: ${consentId}`);
    if (consent.status !== 'active') throw new ValidationError('Consent is not active.');
    if (!input.reason) throw new ValidationError('reason is required to withdraw consent.');
    return this.transactional(() => {
      const before = cloneRecord(consent);
      consent.status = 'withdrawn';
      consent.withdrawnAt = new Date();
      consent.withdrawalReason = input.reason;
      consent.touch(consent.withdrawnAt);
      this.recordEvent('consent.withdrawn', consent, actorId, { reason: input.reason });
      return this.recordUpdate('consents', before, consent, actorId, 'consent.withdraw', {
        reason: input.reason
      });
    });
  }

  createDocumentShare(input, actorId = null) {
    const token = randomBytes(32).toString('base64url');
    return this.transactional(() => {
      const share = super.createDocumentShare({
        ...input,
        tokenHash: hashToken(token)
      }, actorId);
      this.recordCreate('documentShares', share, actorId, 'document-share.create');
      Object.defineProperty(share, 'accessToken', {
        configurable: true,
        enumerable: false,
        value: token
      });
      return share;
    });
  }

  revokeDocumentShare(shareId, input, actorId = null) {
    const share = this.documentShares.get(shareId);
    if (!share) throw new ValidationError(`Unknown document share: ${shareId}`);
    if (!input.reason) throw new ValidationError('reason is required to revoke a share.');
    return this.transactional(() => {
      const before = cloneRecord(share);
      share.status = input.status === 'refused' ? 'refused' : 'revoked';
      share.revokedAt = new Date();
      share.touch(share.revokedAt);
      this.recordEvent(`document-share.${share.status}`, share, actorId, { reason: input.reason });
      return this.recordUpdate('documentShares', before, share, actorId, `document-share.${share.status}`, {
        reason: input.reason
      });
    });
  }

  async accessDocumentShare(token, context = {}) {
    const share = Array.from(this.documentShares.values())
      .find((candidate) => candidate.tokenHash === hashToken(token));
    if (!share || share.status !== 'active' || share.revokedAt || Date.parse(share.expiresAt) <= Date.now()) {
      throw new ValidationError('Share token is invalid, refused, revoked, or expired.');
    }
    const document = this.documents.get(share.documentId);
    if (!document || ['archived', 'expired'].includes(document.status)) {
      throw new ValidationError('Shared document is no longer available.');
    }
    const allowlist = new Set(['id', 'type', 'title', 'documentNumber', 'issuedAt', 'expiresAt', 'fileHash', 'hashAlgorithm']);
    const result = Object.fromEntries(
      share.dataScope.filter((field) => allowlist.has(field)).map((field) => [field, document[field]])
    );
    await this.writeAuditEntry({
      actorId: 'public-share',
      organizationId: share.organizationId,
      entityType: 'DocumentShare',
      entityId: share.id,
      action: 'document-share.access',
      after: { fields: Object.keys(result) },
      context
    });
    return result;
  }

  createCollaborationRequest(input, actorId = null) {
    return this.createInstitutionalRecord(
      'collaborationRequests',
      () => super.createCollaborationRequest(input, actorId),
      actorId,
      'collaboration.create'
    );
  }

  decideCollaborationRequest(requestId, input, actorId = null) {
    const collaboration = this.collaborationRequests.get(requestId);
    if (!collaboration) throw new ValidationError(`Unknown collaboration request: ${requestId}`);
    if (collaboration.status !== 'pending' || Date.parse(collaboration.expiresAt) <= Date.now()) {
      throw new ValidationError('Collaboration request is no longer pending.');
    }
    if (!['accepted', 'refused', 'partial'].includes(input.status)) {
      throw new ValidationError('Collaboration decision must be accepted, refused, or partial.');
    }
    if (!input.reason) throw new ValidationError('reason is required for a collaboration decision.');
    const acceptedDataScope = input.status === 'partial' ? input.acceptedDataScope ?? [] : collaboration.dataScope;
    if (!acceptedDataScope.every((field) => collaboration.dataScope.includes(field))) {
      throw new ValidationError('acceptedDataScope exceeds the requested scope.');
    }
    return this.transactional(() => {
      const before = cloneRecord(collaboration);
      collaboration.status = input.status;
      collaboration.acceptedDataScope = input.status === 'refused' ? [] : acceptedDataScope;
      collaboration.decisionReason = input.reason;
      collaboration.decidedAt = new Date();
      collaboration.touch(collaboration.decidedAt);
      this.recordEvent(`collaboration.${input.status}`, collaboration, actorId, { reason: input.reason });
      return this.recordUpdate(
        'collaborationRequests',
        before,
        collaboration,
        actorId,
        `collaboration.${input.status}`,
        { reason: input.reason }
      );
    });
  }

  createTransfer(input, actorId = null) {
    return this.createInstitutionalRecord(
      'transfers',
      () => super.createTransfer(input, actorId),
      actorId,
      'transfer.create'
    );
  }

  transitionTransfer(transferId, input, actorId = null) {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new ValidationError(`Unknown transfer: ${transferId}`);
    const allowed = {
      draft: ['requested', 'cancelled'],
      requested: ['validated', 'refused', 'cancelled', 'expired'],
      validated: ['sent', 'refused', 'cancelled'],
      sent: ['acknowledged', 'refused'],
      acknowledged: [],
      refused: [],
      cancelled: [],
      expired: []
    };
    if (!(allowed[transfer.status] ?? []).includes(input.status)) {
      throw new ValidationError(`Transition from ${transfer.status} to ${input.status} is not allowed.`);
    }
    if (!input.reason) throw new ValidationError('reason is required for a transfer transition.');
    let enrollmentContext = null;
    if (input.status === 'acknowledged' && input.createEnrollment === true) {
      const sourceLearner = this.learners.get(transfer.learnerId);
      const sourcePerson = this.people.get(sourceLearner.personId);
      if (!transfer.requestedData.includes('identity') || !transfer.requestedData.includes('enrollment')) {
        throw new ValidationError('Enrollment creation requires identity and enrollment in requestedData.');
      }
      if (transfer.authorizationBasis === 'consent') {
        const consent = this.consents.get(transfer.consentId);
        if (!consent || consent.status !== 'active' || consent.withdrawnAt
          || Date.parse(consent.expiresAt) <= Date.now()
          || consent.recipientOrganizationId !== transfer.destinationOrganizationId
          || consent.subjectPersonId !== sourcePerson.id
          || !transfer.requestedData.every((field) => consent.dataScope.includes(field))) {
          throw new ValidationError('Transfer consent is no longer valid for enrollment creation.');
        }
      }
      const destinationClassId = input.destinationClassId ?? transfer.destinationClassId;
      const destinationAcademicYearId = input.destinationAcademicYearId ?? transfer.destinationAcademicYearId;
      this.assertTenantRecord(this.classes, destinationClassId, transfer.destinationOrganizationId, 'destination class');
      this.assertTenantRecord(
        this.academicYears,
        destinationAcademicYearId,
        transfer.destinationOrganizationId,
        'destination academic year'
      );
      enrollmentContext = { sourceLearner, sourcePerson, destinationClassId, destinationAcademicYearId };
    }
    return this.transactional(async () => {
      const before = cloneRecord(transfer);
      const changedAt = new Date();
      transfer.history.push({
        from: transfer.status,
        to: input.status,
        reason: input.reason,
        actorId,
        changedAt: changedAt.toISOString()
      });
      transfer.status = input.status;
      if (input.status === 'validated') transfer.validatedAt = changedAt;
      if (input.status === 'acknowledged') transfer.acknowledgedAt = changedAt;
      transfer.touch(changedAt);
      this.recordEvent(`transfer.${input.status}`, transfer, actorId, { reason: input.reason });

      if (enrollmentContext) {
        const { sourceLearner, sourcePerson, destinationClassId, destinationAcademicYearId } = enrollmentContext;
        const destinationPerson = FoundationService.prototype.registerPerson.call(this, {
          givenName: sourcePerson.givenName,
          familyName: sourcePerson.familyName,
          preferredName: transfer.requestedData.includes('identity') ? sourcePerson.preferredName : null,
          birthDate: transfer.requestedData.includes('birthDate') ? sourcePerson.birthDate : null,
          primaryOrganizationId: transfer.destinationOrganizationId
        }, actorId);
        this.recordCreate('people', destinationPerson, actorId, 'person.transfer-create');
        const destinationLearner = FoundationService.prototype.createLearner.call(this, {
          organizationId: transfer.destinationOrganizationId,
          personId: destinationPerson.id,
          learnerNumber: input.destinationLearnerNumber,
          sourceLearnerId: sourceLearner.id,
          sourceOrganizationId: transfer.sourceOrganizationId
        }, actorId);
        destinationLearner.sourceLearnerId = sourceLearner.id;
        destinationLearner.sourceOrganizationId = transfer.sourceOrganizationId;
        this.recordCreate('learners', destinationLearner, actorId, 'learner.transfer-create');
        const enrollment = FoundationService.prototype.createEnrollment.call(this, {
          organizationId: transfer.destinationOrganizationId,
          personId: destinationPerson.id,
          learnerId: destinationLearner.id,
          classId: destinationClassId,
          academicYearId: destinationAcademicYearId,
          enrollmentReference: input.enrollmentReference
        }, actorId);
        this.recordCreate('enrollments', enrollment, actorId, 'enrollment.transfer-create');
        transfer.destinationEnrollmentId = enrollment.id;
      }

      return this.recordUpdate('transfers', before, transfer, actorId, `transfer.${input.status}`, {
        context: {
          sourceOrganizationId: transfer.sourceOrganizationId,
          destinationOrganizationId: transfer.destinationOrganizationId
        },
        reason: input.reason
      });
    });
  }

  async verifyPublicCredential(publicReference, context = {}) {
    const credential = Array.from(this.credentials.values())
      .find((candidate) =>
        candidate.publicReference === publicReference
        && candidate.publicVerificationEnabled !== false
      );
    if (!credential) return null;
    const document = this.documents.get(credential.documentId);
    const issuer = this.organizations.get(credential.issuerOrganizationId);
    const holder = this.people.get(credential.holderId);
    const now = Date.now();
    const effectiveStatus = credential.expiresAt && Date.parse(credential.expiresAt) <= now
      && !['revoked', 'replaced', 'void'].includes(credential.status)
      ? 'expired'
      : credential.status;
    const result = {
      reference: credential.publicReference,
      credentialNumber: credential.credentialNumber,
      credentialType: credential.credentialType,
      qualification: credential.qualification,
      status: effectiveStatus,
      integrity: Boolean(document && credential.fileHash === document.fileHash),
      issuedAt: credential.awardedAt,
      validFrom: credential.validFrom,
      expiresAt: credential.expiresAt,
      replacementReference: credential.replacedByCredentialId
        ? this.credentials.get(credential.replacedByCredentialId)?.publicReference ?? null
        : null,
      issuer: issuer ? { legalName: issuer.legalName, countryCode: issuer.countryCode } : null,
      holder: holder ? { givenName: holder.givenName, familyName: holder.familyName } : null
    };
    await this.writeAuditEntry({
      actorId: 'public-verifier',
      organizationId: credential.organizationId,
      entityType: 'CredentialRecord',
      entityId: credential.id,
      action: 'credential.public-verify',
      after: { status: result.status, integrity: result.integrity },
      context
    });
    return result;
  }

  recordSensitiveAccess({ actorId, organizationId, resource, entityId = null, context = {} }) {
    const sensitiveResources = new Set([
      'documents',
      'credentials',
      'documentShares',
      'consents',
      'collaborationRequests',
      'transfers',
      'guardianProfiles',
      'discipline'
    ]);
    if (!sensitiveResources.has(resource)) return null;
    return this.writeAuditEntry({
      actorId,
      organizationId,
      entityType: resource,
      entityId: entityId ?? '*',
      action: `${resource}.access`,
      context
    });
  }

  configureGradingSystem(input, actorId = null) {
    return this.transactional(() => this.recordCreate('gradingSystems', super.configureGradingSystem(input, actorId), actorId, 'grading-system.create'));
  }

  recordGrade(input, actorId = null) {
    return this.transactional(() => this.recordCreate('grades', super.recordGrade(input, actorId), actorId, 'grade.create'));
  }

  recordAttendance(input, actorId = null) {
    return this.transactional(() => {
      const record = super.recordAttendance(input, actorId);
      this.recordCreate('attendance', record, actorId, 'attendance.create');
      return record;
    });
  }

  createScheduleEntry(input, actorId = null) {
    return this.transactional(() => this.recordCreate('scheduleEntries', super.createScheduleEntry(input, actorId), actorId, 'schedule-entry.create'));
  }

  createAssignment(input, actorId = null) {
    return this.transactional(() => this.recordCreate('assignments', super.createAssignment(input, actorId), actorId, 'assignment.create'));
  }

  publishAssignment(assignmentId, actorId = null) {
    return this.transactional(() => {
      const before = cloneRecord(this.assignments.get(assignmentId));
      const assignment = super.publishAssignment(assignmentId, actorId);
      if (before?.status !== 'published') {
        this.recordUpdate('assignments', before, assignment, actorId, 'assignment.publish');
      }
      return assignment;
    });
  }

  saveAttendanceRoster(input, actorId = null) {
    return this.transactional(() => {
      const beforeById = new Map(Array.from(this.attendance.values()).map((record) => [record.id, cloneRecord(record)]));
      const result = super.saveAttendanceRoster(input, actorId);
      for (const record of result.participants) {
        const before = beforeById.get(record.id);
        if (before) this.recordUpdate('attendance', before, record, actorId, 'attendance.roster-update');
        else this.persistRecord('attendance', record, { actorId, action: 'attendance.roster-create' });
      }
      return result;
    });
  }

  async configureCustomDomain(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const domain = normalizeCustomDomain(input.domain, process.env.RENDER_EXTERNAL_HOSTNAME);
    const token = randomBytes(24).toString('base64url');
    const record = new PlatformRecord({
      id: createPermanentId('domain'),
      organizationId: input.organizationId,
      domain,
      status: 'pending',
      verificationState: 'pending',
      verificationToken: token,
      accessState: 'active',
      problem: null,
      verifiedAt: null,
      instructions: domainVerificationInstructions(domain, token)
    });
    try {
      return await this.transactional(() => {
        const claim = this.connection.run(
          'INSERT INTO custom_domain_claims(domain, entity_id, organization_id, created_at) VALUES (?, ?, ?, ?)',
          [domain, record.id, record.organizationId, new Date().toISOString()]
        );
        const persist = () => {
          this.customDomains.set(record.id, record);
          const entityPersistence = this.persistRecord('customDomains', record, { actorId, action: 'custom-domain.configure' });
          const audit = this.writeAuditEntry({
            actorId, organizationId: record.organizationId, entityType: 'CustomDomain',
            entityId: record.id, action: 'custom-domain.configure', after: { domain, verificationState: 'pending' }
          });
          return entityPersistence instanceof Promise || audit instanceof Promise
            ? Promise.all([entityPersistence, audit]).then(() => record)
            : record;
        };
        return claim instanceof Promise ? claim.then(persist) : persist();
      });
    } catch (error) {
      if (/unique|duplicate/i.test(error.message)) {
        throw new ValidationError('This domain is already associated with an institution.');
      }
      throw error;
    }
  }

  listCustomDomains(organizationId) {
    const items = Array.from(this.customDomains.values()).filter((entry) => entry.organizationId === organizationId && entry.status !== 'archived');
    return { items, page: { total: items.length, limit: items.length, offset: 0 } };
  }

  async verifyCustomDomain(id, actorId = null) {
    const record = this.customDomains.get(id);
    if (!record) throw new ValidationError(`Unknown custom domain: ${id}`);
    let verified = false;
    try {
      verified = await this.domainVerifier(record.domain, record.verificationToken);
    } catch {
      verified = false;
    }
    return this.transactional(() => {
      const before = cloneRecord(record);
      record.verificationState = verified ? 'verified' : 'failed';
      record.verifiedAt = verified ? new Date().toISOString() : null;
      record.problem = verified ? null : 'DNS TXT verification record was not found.';
      record.touch();
      return this.recordUpdate('customDomains', before, record, actorId, 'custom-domain.verify');
    });
  }

  getCustomDomainForHost(host) {
    let domain;
    try {
      domain = normalizeCustomDomain(host, null);
    } catch {
      return null;
    }
    return Array.from(this.customDomains.values()).find((entry) =>
      entry.domain === domain && entry.status !== 'archived') ?? null;
  }

  resolveVerifiedTenantByHost(host) {
    const entry = this.getCustomDomainForHost(host);
    return entry?.verificationState === 'verified' && entry.accessState === 'active' ? entry : null;
  }

  listDomainGovernance() {
    return {
      domains: Array.from(this.customDomains.values()).map((entry) => ({
        id: entry.id,
        organizationId: entry.organizationId,
        organizationName: this.organizations.get(entry.organizationId)?.displayName ?? null,
        domain: entry.domain,
        verificationState: entry.verificationState,
        accessState: entry.accessState,
        problem: entry.problem,
        verifiedAt: entry.verifiedAt
      })),
      subscriptions: Array.from(this.platformSubscriptions.values()).map((entry) => ({
        id: entry.id, organizationId: entry.organizationId, plan: entry.plan, status: entry.status,
        startsOn: entry.startsOn, endsOn: entry.endsOn
      }))
    };
  }

  governCustomDomain(id, input, actorId = null) {
    const record = this.customDomains.get(id);
    if (!record) throw new ValidationError(`Unknown custom domain: ${id}`);
    if (input.accessState != null && !['active', 'suspended'].includes(input.accessState)) {
      throw new ValidationError('accessState must be active or suspended.');
    }
    if (input.verificationState != null && !['pending', 'verified', 'failed'].includes(input.verificationState)) {
      throw new ValidationError('verificationState must be pending, verified, or failed.');
    }
    return this.transactional(() => {
      const before = cloneRecord(record);
      if (input.accessState != null) record.accessState = input.accessState;
      if (input.verificationState != null) {
        record.verificationState = input.verificationState;
        record.verifiedAt = input.verificationState === 'verified' ? new Date().toISOString() : null;
      }
      if (Object.hasOwn(input, 'problem')) record.problem = input.problem == null ? null : String(input.problem).slice(0, 500);
      record.touch();
      return this.recordUpdate('customDomains', before, record, actorId, 'platform.custom-domain.govern');
    });
  }

  governPlatformSubscription(id, input, actorId = null) {
    const subscription = this.platformSubscriptions.get(id);
    if (!subscription) throw new ValidationError(`Unknown subscription: ${id}`);
    if (!['active', 'suspended', 'cancelled'].includes(input.status)) throw new ValidationError('status must be active, suspended, or cancelled.');
    return this.transactional(() => {
      const before = cloneRecord(subscription);
      subscription.status = input.status;
      subscription.touch();
      return this.recordUpdate('platformSubscriptions', before, subscription, actorId, 'platform.subscription.govern');
    });
  }

  getDomainProviderStatus() {
    const threshold = Number(process.env.DOMAIN_PROVIDER_LOW_BALANCE_THRESHOLD ?? 100);
    const status = this.domainProvider.status();
    return {
      ...status,
      lowBalanceThreshold: threshold,
      lowBalance: status.balance?.amount != null && Number(status.balance.amount) < threshold,
      livePurchasingEnabled: status.provider === 'openprovider' && status.available === true
    };
  }

  upsertDomainTld(input, actorId = null) {
    const tld = String(input.tld ?? '').trim().toLowerCase().replace(/^\./, '');
    if (!/^[a-z0-9-]{2,63}$/.test(tld)) throw new ValidationError('tld must be a valid extension.');
    const currency = String(input.currency ?? 'USD').toUpperCase();
    const prices = ['wholesaleCost', 'salePrice', 'registrationPrice', 'renewalPrice', 'transferPrice'];
    for (const field of prices) {
      if (!Number.isFinite(Number(input[field])) || Number(input[field]) < 0) {
        throw new ValidationError(`${field} must be a non-negative number.`);
      }
    }
    const existing = [...this.domainTldCatalog.values()].find((entry) => entry.tld === tld);
    const record = new PlatformRecord({
      ...(existing ?? {}),
      id: existing?.id ?? createPermanentId('tld'),
      organizationId: null,
      tld,
      enabled: input.enabled !== false,
      currency,
      wholesaleCost: Number(input.wholesaleCost),
      salePrice: Number(input.salePrice),
      registrationPrice: Number(input.registrationPrice),
      renewalPrice: Number(input.renewalPrice),
      transferPrice: Number(input.transferPrice),
      margin: Number(input.salePrice) - Number(input.wholesaleCost),
      effectiveFrom: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effectiveUntil: input.effectiveUntil ?? null
    });
    return this.transactional(() => existing
      ? this.recordUpdate('domainTldCatalog', cloneRecord(existing), record, actorId, 'domain.catalog.update')
      : this.recordCreate('domainTldCatalog', record, actorId, 'domain.catalog.create'));
  }

  listDomainTldCatalog({ enabledOnly = false } = {}) {
    const items = [...this.domainTldCatalog.values()]
      .filter((entry) => entry.status !== 'archived' && (!enabledOnly || entry.enabled))
      .sort((left, right) => left.tld.localeCompare(right.tld));
    return { items, page: { total: items.length, limit: items.length, offset: 0 } };
  }

  async quoteDomain(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const domain = normalizeCustomDomain(input.domain, process.env.RENDER_EXTERNAL_HOSTNAME);
    const idempotencyKey = String(input.idempotencyKey ?? '').trim();
    if (!idempotencyKey) throw new ValidationError('idempotencyKey is required.');
    const duplicate = [...this.domainQuotes.values()].find((entry) =>
      entry.organizationId === input.organizationId && entry.idempotencyKey === idempotencyKey);
    if (duplicate) return duplicate;
    const tld = domain.split('.').at(-1);
    const catalog = [...this.domainTldCatalog.values()].find((entry) =>
      entry.tld === tld && entry.enabled && entry.status !== 'archived');
    if (!catalog) throw new ValidationError(`Registration is not enabled for .${tld}.`);
    const providerQuote = await this.domainProvider.quote(domain);
    const record = new PlatformRecord({
      id: createPermanentId('domain-quote'),
      organizationId: input.organizationId,
      idempotencyKey,
      domain,
      available: providerQuote.available === true,
      provider: this.domainProvider.code,
      providerReference: providerQuote.providerReference ?? null,
      currency: catalog.currency,
      registrationPrice: catalog.registrationPrice,
      renewalPrice: catalog.renewalPrice,
      transferPrice: catalog.transferPrice,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
    });
    return this.transactional(() =>
      this.recordCreate('domainQuotes', record, actorId, 'domain.quote.create'));
  }

  createDomainOrder(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const idempotencyKey = String(input.idempotencyKey ?? '').trim();
    if (!idempotencyKey) throw new ValidationError('idempotencyKey is required.');
    const duplicate = [...this.domainOrders.values()].find((entry) =>
      entry.organizationId === input.organizationId && entry.idempotencyKey === idempotencyKey);
    if (duplicate) return duplicate;
    const quote = this.domainQuotes.get(input.quoteId);
    if (!quote || quote.organizationId !== input.organizationId) {
      throw new ValidationError('A tenant-scoped domain quote is required.');
    }
    if (!quote.available) throw new ValidationError('The quoted domain is unavailable.');
    if (new Date(quote.expiresAt).getTime() <= Date.now()) throw new ValidationError('The domain quote has expired.');
    const registrant = input.registrant;
    if (!registrant || !registrant.name || !registrant.email || !registrant.countryCode) {
      throw new ValidationError('Registrant name, email, and countryCode are required.');
    }
    if (input.registrantConsent !== true) throw new ValidationError('Registrant consent is required.');
    const billingCycle = input.billingCycle === 'annual' ? 'annual' : 'monthly';
    const subscriptionAmount = Number(input.subscriptionAmount);
    if (!Number.isFinite(subscriptionAmount) || subscriptionAmount < 0) {
      throw new ValidationError('subscriptionAmount must be a non-negative number.');
    }
    const record = new PlatformRecord({
      id: createPermanentId('domain-order'),
      organizationId: input.organizationId,
      idempotencyKey,
      quoteId: quote.id,
      domain: quote.domain,
      orderType: input.orderType ?? 'registration',
      plan: input.plan ?? 'premium',
      billingCycle,
      registrant: {
        name: String(registrant.name).slice(0, 200),
        email: String(registrant.email).slice(0, 254),
        countryCode: String(registrant.countryCode).toUpperCase(),
        organization: String(registrant.organization ?? '').slice(0, 200)
      },
      registrantConsentAt: new Date().toISOString(),
      sponsoringRegistrar: this.domainProvider.code === 'openprovider' ? 'Openprovider' : 'Not assigned (manual/disabled mode)',
      ownership: 'Institution is registrant/owner; Eduplateforme acts only as reseller and technical manager.',
      lineItems: [
        {
          type: 'saas_subscription',
          description: `${input.plan ?? 'premium'} SaaS subscription (${billingCycle})`,
          billingCycle,
          amount: subscriptionAmount,
          currency: quote.currency
        },
        {
          type: 'domain_registration',
          description: `${quote.domain} registration (annual)`,
          billingCycle: 'annual',
          amount: quote.registrationPrice,
          renewalAmount: quote.renewalPrice,
          currency: quote.currency,
          promotionAmount: Number(input.firstYearPromotionAmount ?? 0)
        }
      ],
      paymentState: 'pending',
      refundState: 'not_requested',
      lifecycleState: 'pending_payment',
      timelineState: 'payment_pending',
      providerReference: null,
      lastError: null,
      registrationDate: null,
      expiryDate: null,
      autoRenew: input.autoRenew !== false,
      dnsState: 'pending',
      tlsState: 'pending',
      noticesSent: []
    });
    return this.transactional(() =>
      this.recordCreate('domainOrders', record, actorId, 'domain.order.create'));
  }

  listDomainOrders(organizationId = null, { includeRegistrant = false } = {}) {
    const items = [...this.domainOrders.values()]
      .filter((entry) => entry.status !== 'archived' && (!organizationId || entry.organizationId === organizationId))
      .map((entry) => ({
        ...entry,
        registrant: includeRegistrant ? entry.registrant : undefined,
        transferAuthCodeHash: undefined
      }));
    return { items, page: { total: items.length, limit: items.length, offset: 0 } };
  }

  markDomainOrderPaid(id, input, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    if (input.confirmed !== true || !String(input.reason ?? '').trim()) {
      throw new ValidationError('Manual payment confirmation and reason are required.');
    }
    if (order.paymentState === 'paid') return order;
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.paymentState = 'paid';
      order.lifecycleState = 'pending_registration';
      order.timelineState = 'domain_pending';
      order.paymentConfirmedAt = new Date().toISOString();
      order.paymentConfirmationReason = String(input.reason).slice(0, 500);
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.payment.confirm');
    });
  }

  async submitDomainRegistration(id, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    if (order.paymentState !== 'paid') throw new ValidationError('A domain order cannot be registered before authenticated payment confirmation.');
    if (order.providerReference) return order;
    let result;
    try {
      result = await this.domainProvider.register({
        domain: order.domain,
        registrant: order.registrant,
        period: 1,
        idempotencyKey: order.id
      });
    } catch (error) {
      await this.transactional(() => {
        const before = cloneRecord(order);
        order.lastError = error.message;
        order.touch();
        return this.recordUpdate('domainOrders', before, order, actorId, 'domain.registration.failed');
      });
      throw error;
    }
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.providerReference = result.providerReference ?? result.id ?? null;
      order.registrationDate = result.registrationDate ?? new Date().toISOString().slice(0, 10);
      order.expiryDate = result.expiryDate ?? null;
      order.lifecycleState = 'pending_dns';
      order.timelineState = 'dns_pending';
      order.lastError = null;
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.registration.submitted');
    });
  }

  updateDomainProvisioning(id, input, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    const dnsState = input.dnsState ?? order.dnsState;
    const tlsState = input.tlsState ?? order.tlsState;
    if (!['pending', 'verified', 'failed'].includes(dnsState) || !['pending', 'provisioning', 'active', 'failed'].includes(tlsState)) {
      throw new ValidationError('Invalid DNS or TLS state.');
    }
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.dnsState = dnsState;
      order.tlsState = tlsState;
      order.diagnostic = input.diagnostic == null ? order.diagnostic : String(input.diagnostic).slice(0, 500);
      if (dnsState === 'verified' && tlsState === 'active') {
        order.lifecycleState = 'active';
        order.timelineState = 'active';
      } else if (dnsState === 'verified') {
        order.lifecycleState = 'pending_tls';
        order.timelineState = 'tls_pending';
      } else {
        order.lifecycleState = 'pending_dns';
        order.timelineState = 'dns_pending';
      }
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.provisioning.update');
    });
  }

  setDomainAutoRenew(id, enabled, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.autoRenew = enabled === true;
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.auto-renew.update');
    });
  }

  requestDomainRenewal(id, input, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    const idempotencyKey = String(input.idempotencyKey ?? '').trim();
    if (!idempotencyKey) throw new ValidationError('idempotencyKey is required.');
    if (order.renewalIdempotencyKeys?.includes(idempotencyKey)) return order;
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.renewalPaymentState = 'pending';
      order.renewalRequestedAt = new Date().toISOString();
      order.renewalPrice = order.lineItems.find((line) => line.type === 'domain_registration')?.renewalAmount ?? null;
      order.renewalIdempotencyKeys = [...(order.renewalIdempotencyKeys ?? []), idempotencyKey];
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.renewal.request');
    });
  }

  cancelDomainManagement(id, input, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    if (input.confirmation !== order.domain || !String(input.reason ?? '').trim()) {
      throw new ValidationError('Cancellation requires the exact domain and a reason.');
    }
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.autoRenew = false;
      order.managementCancelledAt = new Date().toISOString();
      order.managementCancellationReason = String(input.reason).slice(0, 500);
      order.transferRightsPreserved = true;
      order.dataGraceUntil = new Date(Date.now() + 30 * 86_400_000).toISOString();
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.management.cancel');
    });
  }

  reconcileDomainOrder(id, input, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    if (!String(input.reason ?? '').trim()) throw new ValidationError('A reconciliation reason is required.');
    const paymentStates = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];
    const refundStates = ['not_requested', 'pending', 'completed', 'failed'];
    if (input.paymentState && !paymentStates.includes(input.paymentState)) throw new ValidationError('Invalid paymentState.');
    if (input.refundState && !refundStates.includes(input.refundState)) throw new ValidationError('Invalid refundState.');
    return this.transactional(() => {
      const before = cloneRecord(order);
      if (input.paymentState) order.paymentState = input.paymentState;
      if (input.refundState) order.refundState = input.refundState;
      if (Object.hasOwn(input, 'providerReference')) order.providerReference = input.providerReference || null;
      if (Object.hasOwn(input, 'lastError')) order.lastError = input.lastError || null;
      order.reconciledAt = new Date().toISOString();
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.order.reconcile', {
        reason: String(input.reason).slice(0, 500)
      });
    });
  }

  requestDomainTransfer(id, input, actorId = null) {
    const order = this.domainOrders.get(id);
    if (!order) throw new ValidationError(`Unknown domain order: ${id}`);
    if (input.confirmation !== order.domain || !String(input.reason ?? '').trim()) {
      throw new ValidationError('Transfer requires the exact domain confirmation and a reason.');
    }
    return this.transactional(() => {
      const before = cloneRecord(order);
      order.lifecycleState = 'transfer_pending';
      order.timelineState = 'domain_pending';
      order.autoRenew = false;
      order.transferRequestedAt = new Date().toISOString();
      order.transferReason = String(input.reason).slice(0, 500);
      if (input.authCode) order.transferAuthCodeHash = hashToken(input.authCode);
      order.touch();
      return this.recordUpdate('domainOrders', before, order, actorId, 'domain.transfer.request');
    });
  }

  collectDomainRenewalNotices(now = new Date(), actorId = 'system') {
    const notices = [];
    for (const order of this.domainOrders.values()) {
      if (!order.expiryDate || !['active', 'expiring'].includes(order.lifecycleState)) continue;
      const days = Math.ceil((new Date(order.expiryDate).getTime() - now.getTime()) / 86_400_000);
      const threshold = [60, 30, 15, 7].find((value) => days <= value && !order.noticesSent.includes(value));
      if (!threshold) continue;
      const before = cloneRecord(order);
      order.lifecycleState = days <= 0 ? 'expired' : 'expiring';
      order.noticesSent = [...order.noticesSent, threshold];
      order.touch(now);
      this.recordUpdate('domainOrders', before, order, actorId, 'domain.renewal.notice');
      notices.push({ orderId: order.id, organizationId: order.organizationId, domain: order.domain, days: threshold });
    }
    return notices;
  }

  submitAssignment(input, actorId = null) {
    return this.transactional(() => this.recordCreate('assignmentSubmissions', super.submitAssignment(input, actorId), actorId, 'assignment-submission.create'));
  }

  gradeSubmission(submissionId, input, actorId = null) {
    return this.transactional(() => {
      this.assertExists(this.assignmentSubmissions, submissionId, 'submission');
      const before = cloneRecord(this.assignmentSubmissions.get(submissionId));
      const submission = this.assignmentSubmissions.get(submissionId);
      submission.score = Number(input.score);
      submission.maxScore = Number(input.maxScore ?? 20);
      submission.touch();
      this.recordEvent('assignments.submission.graded', submission, actorId);

      const grade = EducationPlatformService.prototype.recordGrade.call(this, {
        organizationId: submission.organizationId,
        learnerId: submission.learnerId,
        assignmentId: submission.assignmentId,
        score: submission.score,
        maxScore: submission.maxScore,
        coefficient: Number(input.coefficient ?? 1)
      }, actorId);

      this.recordUpdate('assignmentSubmissions', before, submission, actorId, 'assignment-submission.grade');
      this.persistRecord('grades', grade, { actorId, action: 'grade.create' });
      return grade;
    });
  }

  generateReportCard(input, actorId = null) {
    return this.transactional(() => this.recordCreate('reportCards', super.generateReportCard(input, actorId), actorId, 'report.create'));
  }

  configureFee(input, actorId = null) {
    return this.transactional(() => this.recordCreate('fees', super.configureFee(input, actorId), actorId, 'fee.create'));
  }

  createInvoice(input, actorId = null) {
    return this.transactional(() => this.recordCreate('invoices', super.createInvoice(input, actorId), actorId, 'invoice.create'));
  }

  recordPayment(input, actorId = null) {
    return this.transactional(() => {
      const invoiceBefore = cloneRecord(this.invoices.get(input.invoiceId));
      const payment = super.recordPayment(input, actorId);
      this.recordCreate('payments', payment, actorId, 'payment.create');
      this.recordUpdate('invoices', invoiceBefore, this.invoices.get(input.invoiceId), actorId, 'invoice.balance-update');
      return payment;
    });
  }

  createNotification(input, actorId = null) {
    return this.transactional(() => this.recordCreate('notifications', super.createNotification(input, actorId), actorId, 'notification.create'));
  }

  markNotificationSent(notificationId, actorId = null) {
    return this.transactional(() => {
      const before = cloneRecord(this.notifications.get(notificationId));
      const notification = super.markNotificationSent(notificationId, actorId);
      return this.recordUpdate('notifications', before, notification, actorId, 'notification.sent');
    });
  }

  createDiscussionThread(input, actorId = null) {
    return this.transactional(() => this.recordCreate('threads', super.createDiscussionThread(input, actorId), actorId, 'thread.create'));
  }

  postThreadMessage(input, actorId = null) {
    return this.transactional(() => this.recordCreate('messages', super.postThreadMessage(input, actorId), actorId, 'message.create'));
  }

  recordDiscipline(input, actorId = null) {
    return this.transactional(() => this.recordCreate('disciplineRecords', super.recordDiscipline(input, actorId), actorId, 'discipline.create'));
  }

  createCalendarEvent(input, actorId = null) {
    return this.transactional(() => this.recordCreate('calendarEvents', super.createCalendarEvent(input, actorId), actorId, 'calendar-event.create'));
  }

  createVirtualSchool(input, actorId = null) {
    return this.transactional(() => this.recordCreate('virtualSchools', super.createVirtualSchool(input, actorId), actorId, 'virtual-school.create'));
  }

  createPaidTraining(input, actorId = null) {
    return this.transactional(() => this.recordCreate('paidTrainings', super.createPaidTraining(input, actorId), actorId, 'paid-training.create'));
  }

  issueCertificate(input, actorId = null) {
    return this.transactional(() => this.recordCreate('certificates', super.issueCertificate(input, actorId), actorId, 'certificate.create'));
  }

  upsertLocalizationProfile(input, actorId = null) {
    return this.transactional(() => {
      const previous = this.localizationProfiles.get(input.organizationId);
      const profile = super.upsertLocalizationProfile({ ...input, id: previous?.id ?? input.id }, actorId);
      this.persistRecord('localizationProfiles', profile, { actorId, action: previous ? 'localization.update' : 'localization.create' });
      this.writeAuditEntry({
        actorId,
        organizationId: profile.organizationId,
        entityType: 'LocalizationProfile',
        entityId: profile.id,
        action: previous ? 'localization.update' : 'localization.create',
        before: cloneRecord(previous),
        after: cloneRecord(profile)
      });
      return profile;
    });
  }

  createPlatformSubscription(input, actorId = null) {
    return this.transactional(() => this.recordCreate('platformSubscriptions', super.createPlatformSubscription(input, actorId), actorId, 'subscription.create'));
  }

  recordParentalConsent(input, actorId = null) {
    return this.transactional(() => {
      const consent = super.recordParentalConsent(input, actorId);
      this.persistRecord('parentalConsents', consent, { actorId, action: 'parental-consent.create' });
      this.writeAuditEntry({
        actorId,
        organizationId: consent.organizationId,
        entityType: 'ParentalConsent',
        entityId: consent.id,
        action: 'parental-consent.create',
        after: cloneRecord(consent)
      });
      return consent;
    });
  }

  setLocalPassword(accountId, password) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new ValidationError(`Unknown account: ${accountId}`);
    }

    const now = new Date().toISOString();
    this.connection.run(
      `INSERT INTO auth_credentials(account_id, username, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         username = excluded.username,
         password_hash = excluded.password_hash,
         updated_at = excluded.updated_at`,
      [accountId, account.username.toLowerCase(), hashPassword(password), now, now]
    );
  }

  registerUser(input) {
    const normalizedUsername = input.username.toLowerCase();
    const normalizedEmail = input.email.toLowerCase();
    const existingAccount = Array.from(this.accounts.values()).find((candidate) =>
      candidate.username.toLowerCase() === normalizedUsername || candidate.email === normalizedEmail
    );
    if (existingAccount) {
      throw new ValidationError('An account already uses this username or email address.');
    }

    return this.transactional(() => {
      const actorId = 'self-registration';
      const person = FoundationService.prototype.registerPerson.call(this, {
        givenName: input.givenName,
        familyName: input.familyName,
        contacts: [{ type: 'email', value: input.email.toLowerCase(), isPrimary: true }]
      }, actorId);
      this.recordCreate('people', person, actorId, 'person.self-register');

      const account = FoundationService.prototype.openUserAccount.call(this, {
        personId: person.id,
        username: input.username,
        email: input.email,
        organizationIds: []
      }, actorId);
      account.activate();
      this.recordCreate('accounts', account, actorId, 'account.self-register');
      this.setLocalPassword(account.id, input.password);
      return { person, account };
    });
  }

  onboardAccount(accountId, organizationInput) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new ValidationError(`Unknown account: ${accountId}`);
    }

    if (account.organizationIds.length > 0) {
      throw new ValidationError('This account has already completed onboarding.');
    }

    return this.transactional(() => {
      const person = this.people.get(account.personId);
      const organization = FoundationService.prototype.createOrganization.call(
        this,
        { ...organizationInput, countryCode: organizationInput.countryCode.toUpperCase() },
        account.id
      );
      this.recordCreate('organizations', organization, account.id, 'organization.onboard');

      const localization = new LocalizationProfile({
        organizationId: organization.id,
        userId: account.id,
        countryCode: organization.countryCode,
        city: organizationInput.headquartersAddress?.city ?? 'Not configured',
        language: organizationInput.locale ?? 'fr',
        currency: organizationInput.currency ?? 'USD',
        timezone: organizationInput.timezone ?? 'UTC',
        dateFormat: organizationInput.dateFormat ?? 'YYYY-MM-DD',
        latitude: organizationInput.latitude ?? null,
        longitude: organizationInput.longitude ?? null
      });
      this.recordCreate('localizationProfiles', localization, account.id, 'localization.onboard');

      const personBefore = cloneRecord(person);
      person.primaryOrganizationId = organization.id;
      person.organizationId = organization.id;
      person.touch();
      this.recordUpdate('people', personBefore, person, account.id, 'person.onboard');

      const accountBefore = cloneRecord(account);
      account.organizationIds = [organization.id];
      account.organizationId = organization.id;
      account.metadata = { ...account.metadata, locale: organizationInput.locale ?? 'fr' };
      account.touch();
      this.recordUpdate('accounts', accountBefore, account, account.id, 'account.onboard');
      this.connection.run(
        'UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL',
        [new Date().toISOString(), account.id]
      );

      for (const code of TENANT_ADMIN_PERMISSIONS) {
        if (!this.findPermissionByCode(code)) {
          const permission = FoundationService.prototype.createPermission.call(
            this,
            { code, description: `Tenant administrator permission: ${code}` },
            account.id
          );
          this.recordCreate('permissions', permission, account.id, 'permission.bootstrap');
        }
      }

      let role = Array.from(this.roles.values()).find((candidate) => candidate.code === 'tenant-admin');
      if (!role) {
        role = FoundationService.prototype.createRole.call(this, {
          code: 'tenant-admin',
          name: 'Administrateur de l’organisation',
          permissions: [...TENANT_ADMIN_PERMISSIONS]
        }, account.id);
        this.recordCreate('roles', role, account.id, 'role.bootstrap');
      } else {
        const missingPermissions = TENANT_ADMIN_PERMISSIONS.filter((code) => !role.permissions.includes(code));
        if (missingPermissions.length > 0) {
          const roleBefore = cloneRecord(role);
          role.permissions.push(...missingPermissions);
          role.touch();
          this.recordUpdate('roles', roleBefore, role, account.id, 'role.bootstrap-update');
        }
      }

      const assignment = FoundationService.prototype.assignRole.call(this, {
        personId: person.id,
        roleId: role.id,
        organizationId: organization.id
      }, account.id);
      this.recordCreate('roleAssignments', assignment, account.id, 'role-assignment.onboard');
      return { organization, account, person };
    });
  }

  createOrganizationForAccount(accountId, input) {
    const account = this.accounts.get(accountId);
    if (!account || account.organizationIds.length === 0) {
      throw new ValidationError('An onboarded account is required to create another organization.');
    }
    const role = Array.from(this.roles.values()).find((candidate) => candidate.code === 'tenant-admin');
    if (!role) {
      throw new ValidationError('The tenant administrator role is not configured.');
    }

    return this.transactional(() => {
      const organization = FoundationService.prototype.createOrganization.call(this, input, account.id);
      this.recordCreate('organizations', organization, account.id, 'organization.create');

      const accountBefore = cloneRecord(account);
      account.organizationIds.push(organization.id);
      account.touch();
      this.recordUpdate('accounts', accountBefore, account, account.id, 'account.organization-add');

      const assignment = FoundationService.prototype.assignRole.call(this, {
        personId: account.personId,
        roleId: role.id,
        organizationId: organization.id
      }, account.id);
      this.recordCreate('roleAssignments', assignment, account.id, 'role-assignment.organization-add');
      return organization;
    });
  }

  provisionPreviewAccounts(organizationId, actorAccountId) {
    this.assertOrganizationContext(organizationId);
    const actor = this.accounts.get(actorAccountId);
    if (!actor?.organizationIds.includes(organizationId)
      || !this.getRoleCodes(actorAccountId, organizationId).includes('tenant-admin')) {
      throw new ValidationError('A tenant administrator account is required to provision preview accounts.');
    }

    return this.transactional(() => {
      const results = [];
      const credentials = [];
      for (const [roleCode, requiredPermissions] of Object.entries(PREVIEW_ACCOUNT_ROLES)) {
        for (const code of requiredPermissions) {
          if (!this.findPermissionByCode(code)) {
            const permission = FoundationService.prototype.createPermission.call(this, {
              code,
              description: `Preview dashboard permission: ${code}`
            }, actorAccountId);
            this.recordCreate('permissions', permission, actorAccountId, 'permission.preview-account-create');
          }
        }

        let role = [...this.roles.values()].find((candidate) =>
          candidate.code === roleCode && samePermissions(candidate.permissions, requiredPermissions)
        );
        if (!role) {
          role = FoundationService.prototype.createRole.call(this, {
            code: roleCode,
            name: `Preview ${roleCode}`,
            permissions: [...requiredPermissions],
            scope: 'organization'
          }, actorAccountId);
          this.recordCreate('roles', role, actorAccountId, 'role.preview-account-create');
        }

        let account = [...this.accounts.values()].find((candidate) =>
          candidate.metadata?.previewAccountRole === roleCode
          && candidate.metadata?.previewOrganizationId === organizationId
        );
        let person = account ? this.people.get(account.personId) : null;
        let created = false;
        if (!account) {
          const email = `preview-${roleCode}-${organizationId}@demo.eduplateforme.invalid`;
          if ([...this.accounts.values()].some((candidate) => candidate.email === email)) {
            throw new ValidationError(`The reserved preview email for ${roleCode} is already in use.`);
          }
          const usernameBase = `preview-${roleCode}-${organizationId.slice(0, 8)}`.toLowerCase();
          let username = usernameBase;
          let suffix = 1;
          while ([...this.accounts.values()].some((candidate) =>
            candidate.username.toLowerCase() === username.toLowerCase()
          )) {
            username = `${usernameBase}-${suffix++}`;
          }

          person = FoundationService.prototype.registerPerson.call(this, {
            givenName: 'Preview',
            familyName: roleCode,
            primaryOrganizationId: organizationId,
            contacts: [{ type: 'email', value: email, isPrimary: true }],
            metadata: { previewAccountRole: roleCode, previewOrganizationId: organizationId }
          }, actorAccountId);
          this.recordCreate('people', person, actorAccountId, 'person.preview-account-create');

          const temporaryPassword = createPreviewTemporaryPassword();
          account = FoundationService.prototype.openUserAccount.call(this, {
            personId: person.id,
            username,
            email,
            organizationIds: [organizationId],
            lifecycle: {
              metadata: {
                forcePasswordChange: true,
                previewAccountRole: roleCode,
                previewOrganizationId: organizationId
              }
            }
          }, actorAccountId);
          account.activate();
          this.recordCreate('accounts', account, actorAccountId, 'account.preview-account-create');
          this.setLocalPassword(account.id, temporaryPassword);
          credentials.push({ roleCode, username, email, temporaryPassword });
          created = true;
        }

        const assigned = [...this.roleAssignments.values()].some((assignment) =>
          assignment.personId === person.id
          && assignment.roleId === role.id
          && assignment.organizationId === organizationId
          && assignment.status !== 'archived'
        );
        if (!assigned) {
          const assignment = FoundationService.prototype.assignRole.call(this, {
            personId: person.id,
            roleId: role.id,
            organizationId
          }, actorAccountId);
          this.recordCreate('roleAssignments', assignment, actorAccountId, 'role-assignment.preview-account-create');
        }

        results.push({
          roleCode,
          accountId: account.id,
          personId: person.id,
          username: account.username,
          created
        });
      }
      return { organizationId, accounts: results, credentials };
    });
  }

  async createAuthenticationSession(account, organizationId = null) {
    const permissions = this.getAccountPermissions(account.id, organizationId);
    const refreshToken = createRefreshToken();
    const tokenId = randomUUID();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + (1000 * 60 * 60 * 24 * 30)).toISOString();
    await this.connection.run(
      `INSERT INTO refresh_tokens(token_id, account_id, organization_id, refresh_token_hash, expires_at, revoked_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [tokenId, account.id, organizationId, hashToken(refreshToken), refreshExpiresAt, now.toISOString()]
    );

    const accessToken = signJwt({
      sub: account.id,
      personId: account.personId,
      organizationId,
      organizationIds: account.organizationIds,
      permissions,
      username: account.username
    }, { expiresInSeconds: 60 * 60 * 24 });

    return {
      accessToken,
      refreshToken,
      expiresIn: 60 * 60 * 24,
      user: this.getAuthenticatedUserByAccountId(account.id, organizationId)
    };
  }

  async authenticate({ username, password, organizationId = null }) {
    const account = Array.from(this.accounts.values()).find((candidate) =>
      candidate.username.toLowerCase() === String(username).toLowerCase()
      || candidate.email === String(username).toLowerCase()
      || candidate.loginIdentifiers.some((identifier) => identifier.value === String(username).toLowerCase())
    );

    if (!account) {
      throw new ValidationError('Invalid username or password.');
    }

    const credentials = await this.connection.get(
      'SELECT password_hash FROM auth_credentials WHERE account_id = ?',
      [account.id]
    );
    if (!verifyPassword(password, credentials?.password_hash)) {
      throw new ValidationError('Invalid username or password.');
    }

    if (account.status !== 'active') {
      account.activate();
      await this.persistRecord('accounts', account, { actorId: account.id, action: 'account.activate' });
    }

    const resolvedOrganizationId = organizationId ?? account.organizationIds[0] ?? null;
    if (resolvedOrganizationId && !account.organizationIds.includes(resolvedOrganizationId)) {
      throw new ValidationError('Account is not allowed to access this organization.');
    }

    if (account.metadata?.forcePasswordChange === true) {
      return {
        passwordChangeRequired: true,
        challengeToken: signJwt({
          sub: account.id,
          organizationId: resolvedOrganizationId,
          purpose: 'password-change'
        }, { expiresInSeconds: 600 })
      };
    }

    await this.writeAuditEntry({
      actorId: account.id,
      organizationId: resolvedOrganizationId,
      entityType: 'UserAccount',
      entityId: account.id,
      action: 'auth.login',
      after: { organizationId: resolvedOrganizationId }
    });

    const mfa = await this.connection.get(
      "SELECT state FROM mfa_settings WHERE account_id = ? AND state = 'enabled'",
      [account.id]
    );
    if (mfa) {
      return {
        mfaRequired: true,
        challengeToken: signJwt({
          sub: account.id,
          organizationId: resolvedOrganizationId,
          purpose: 'mfa-challenge'
        }, { expiresInSeconds: 300 })
      };
    }

    return this.createAuthenticationSession(account, resolvedOrganizationId);
  }

  async completeRequiredPasswordChange(challengeToken, password) {
    if (typeof password !== 'string' || password.length < 10) {
      throw new ValidationError('password must contain at least 10 characters.');
    }
    const payload = verifyJwt(challengeToken);
    if (!payload || payload.purpose !== 'password-change') {
      throw new ValidationError('Password change challenge is invalid or expired.');
    }
    const account = this.accounts.get(payload.sub);
    if (!account?.metadata?.forcePasswordChange) {
      throw new ValidationError('Password change is not required for this account.');
    }
    const updatePassword = async () => {
      const before = cloneRecord(account);
      await this.setLocalPassword(account.id, password);
      account.metadata = { ...account.metadata, forcePasswordChange: false, passwordChangedAt: new Date().toISOString() };
      account.touch();
      await this.recordUpdate('accounts', before, account, account.id, 'account.password-change-required-complete');
      await this.writeAuditEntry({
        actorId: account.id,
        organizationId: payload.organizationId ?? null,
        entityType: 'UserAccount',
        entityId: account.id,
        action: 'auth.password.changed',
        after: { forcePasswordChange: false }
      });
    };
    if (this.connection.isAsync) await this.transactional(updatePassword);
    else await updatePassword();
    return this.createAuthenticationSession(account, payload.organizationId ?? null);
  }

  executeBulkImport(input, actorId) {
    if (input.dryRun !== false) return executeBulkImport(this, input, actorId);
    this.bulkImportLocks ??= new Map();
    const lockKey = `${input.organizationId}:${input.idempotencyKey}`;
    const previous = this.bulkImportLocks.get(lockKey) ?? Promise.resolve();
    const operation = previous.then(() => executeBulkImport(this, input, actorId));
    const trackedOperation = operation.catch(() => {});
    this.bulkImportLocks.set(lockKey, trackedOperation);
    return operation.finally(() => {
      if (this.bulkImportLocks.get(lockKey) === trackedOperation) this.bulkImportLocks.delete(lockKey);
    });
  }

  async refreshAuthentication(refreshToken) {
    const row = await this.connection.get(
      `SELECT token_id, account_id, organization_id, expires_at, revoked_at, refresh_token_hash
       FROM refresh_tokens
       WHERE refresh_token_hash = ?`,
      [hashToken(refreshToken)]
    );
    if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) {
      throw new ValidationError('Refresh token is invalid or expired.');
    }

    const account = this.accounts.get(row.account_id);
    if (!account) {
      throw new ValidationError('Refresh token does not reference a valid account.');
    }

    const permissions = this.getAccountPermissions(account.id, row.organization_id);
    return {
      accessToken: signJwt({
        sub: account.id,
        personId: account.personId,
        organizationId: row.organization_id,
        organizationIds: account.organizationIds,
        permissions,
        username: account.username
      }, { expiresInSeconds: 60 * 60 * 24 }),
      expiresIn: 60 * 60 * 24,
      user: this.getAuthenticatedUserByAccountId(account.id, row.organization_id)
    };
  }

  async logout(refreshToken, accountId = null) {
    const params = [new Date().toISOString(), hashToken(refreshToken)];
    let sql = 'UPDATE refresh_tokens SET revoked_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL';
    if (accountId) {
      sql += ' AND account_id = ?';
      params.push(accountId);
    }

    await this.connection.run(sql, params);
    return { loggedOut: true };
  }

  verifyAccessToken(token) {
    const payload = verifyJwt(token);
    if (!payload) {
      return null;
    }

    const account = this.accounts.get(payload.sub);
    if (!account) {
      return null;
    }

    return {
      accountId: account.id,
      actorId: account.id,
      personId: account.personId,
      organizationId: payload.organizationId ?? null,
      organizationIds: account.organizationIds,
      permissions: this.getAccountPermissions(account.id, payload.organizationId ?? null),
      username: account.username
    };
  }

  getAuthenticatedUserByAccountId(accountId, organizationId = null) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new ValidationError(`Unknown account: ${accountId}`);
    }

    const person = this.people.get(account.personId) ?? null;
    return {
      accountId: account.id,
      personId: account.personId,
      username: account.username,
      email: account.email,
      status: account.status,
      organizationId,
      organizationIds: account.organizationIds,
      permissions: this.getAccountPermissions(account.id, organizationId),
      profile: person ? { givenName: person.givenName, familyName: person.familyName } : null,
      locale: account.metadata?.locale ?? person?.preferredLocale ?? null,
      organization: organizationId ? (() => {
        const organization = this.organizations.get(organizationId);
        return organization ? {
          id: organization.id,
          displayName: organization.displayName,
          countryCode: organization.countryCode,
          organizationType: organization.organizationType
        } : null;
      })() : null
    };
  }

  updateUserLocale(accountId, locale) {
    if (!['fr', 'en', 'es', 'pt', 'ar'].includes(locale)) {
      throw new ValidationError(`Unsupported language: ${locale}`);
    }
    const account = this.accounts.get(accountId);
    if (!account) throw new ValidationError(`Unknown account: ${accountId}`);
    return this.transactional(() => {
      const before = cloneRecord(account);
      account.metadata = { ...account.metadata, locale };
      account.touch();
      return this.recordUpdate('accounts', before, account, accountId, 'account.locale-update');
    });
  }

  transitionInstitutionalStatus(resource, id, input, actorId = null) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    const collection = this[collectionKey];
    if (!collection?.has(id) || !['operatingAuthorizations', 'accreditations', 'institutionVerifications'].includes(collectionKey)) {
      throw new ValidationError(`Unknown ${resource}: ${id}`);
    }
    this.transitionLocks ??= new Map();
    const lockKey = `${collectionKey}:${id}`;
    const previousOperation = this.transitionLocks.get(lockKey) ?? Promise.resolve();
    const operation = previousOperation.then(() => this.transactional(() => {
      const entity = collection.get(id);
      const allowedStatuses = collectionKey === 'institutionVerifications'
        ? VERIFICATION_STATUSES
        : AUTHORIZATION_STATUSES;
      if (!allowedStatuses.includes(input.status)) {
        throw new ValidationError(`Invalid status transition target: ${input.status}.`);
      }
      const allowedTransitions = {
        draft: ['pending', 'active'],
        pending: ['active', 'suspended', 'revoked'],
        active: ['expired', 'suspended', 'revoked'],
        expired: ['pending', 'active', 'revoked'],
        suspended: ['active', 'revoked'],
        revoked: [],
        UNVERIFIED: ['PENDING_VERIFICATION'],
        PENDING_VERIFICATION: ['VERIFIED', 'VERIFIED_BY_AUTHORITY', 'UNVERIFIED', 'REVOKED'],
        VERIFIED: ['VERIFIED_BY_AUTHORITY', 'SUSPENDED', 'REVOKED'],
        VERIFIED_BY_AUTHORITY: ['SUSPENDED', 'REVOKED'],
        SUSPENDED: ['VERIFIED', 'VERIFIED_BY_AUTHORITY', 'REVOKED'],
        REVOKED: []
      };
      if (!(allowedTransitions[entity.status] ?? []).includes(input.status)) {
        throw new ValidationError(`Transition from ${entity.status} to ${input.status} is not allowed.`);
      }
      const before = cloneRecord(entity);
      const changedAt = new Date();
      entity.history = [
        ...(entity.history ?? []),
        {
          from: entity.status,
          to: input.status,
          reason: input.reason ?? null,
          authority: input.authority ?? null,
          evidenceReference: input.evidenceReference ?? null,
          changedAt: changedAt.toISOString(),
          actorId
        }
      ];
      entity.status = input.status;
      entity.touch(changedAt);
      if (collectionKey === 'institutionVerifications' && ['VERIFIED', 'VERIFIED_BY_AUTHORITY'].includes(input.status)) {
        entity.verifiedAt = input.verifiedAt ?? changedAt.toISOString();
        entity.authority = input.authority ?? entity.authority;
      }
      return this.recordUpdate(collectionKey, before, entity, actorId, `${resource}.transition.${input.status}`);
    }));
    this.transitionLocks.set(lockKey, operation.catch(() => {}));
    return operation;
  }

  withdrawGuardianLearnerRelation(id, input, actorId = null) {
    const relation = this.guardianLearnerRelations.get(id);
    if (!relation) throw new ValidationError(`Unknown guardianLearnerRelations: ${id}`);
    if (relation.status !== 'active') throw new ValidationError('Guardian relation is not active.');
    return this.transactional(() => {
      const before = cloneRecord(relation);
      relation.status = 'withdrawn';
      relation.withdrawnAt = new Date();
      relation.withdrawalReason = input.reason ?? null;
      relation.touch(relation.withdrawnAt);
      return this.recordUpdate('guardianLearnerRelations', before, relation, actorId, 'guardian-learner-relation.withdraw');
    });
  }

  getPublicInstitutionVerification(publicCode) {
    const verification = Array.from(this.institutionVerifications.values())
      .find((candidate) => candidate.publicCode === publicCode);
    if (!verification) return null;
    const organization = this.organizations.get(verification.organizationId);
    if (!organization) return null;
    return {
      publicCode: verification.publicCode,
      status: verification.status,
      authority: verification.authority,
      verifiedAt: verification.verifiedAt,
      validUntil: verification.validUntil,
      publicNote: verification.publicNote,
      institution: {
        displayName: organization.displayName,
        legalName: organization.legalName,
        countryCode: organization.countryCode,
        organizationType: organization.organizationType,
        operationalStatus: organization.operationalStatus
      }
    };
  }

  isContextuallyAllowed(accountId, { organizationId, resource, action, scopeType = 'organization', scopeId = null }) {
    const permissionCode = `${resource}.${action}`;
    const permissions = this.getAccountPermissions(accountId, organizationId);
    if (!permissions.includes('*') && !permissions.includes(permissionCode)) return false;
    const account = this.accounts.get(accountId);
    const roleCodes = new Set(Array.from(this.roleAssignments.values())
      .filter((assignment) => assignment.personId === account?.personId && assignment.organizationId === organizationId)
      .map((assignment) => this.roles.get(assignment.roleId)?.code)
      .filter(Boolean));
    const matchingRules = Array.from(this.contextualPermissionRules.values()).filter((rule) =>
      rule.organizationId === organizationId
      && roleCodes.has(rule.roleCode)
      && rule.resource === resource
      && rule.action === action
      && rule.scopeType === scopeType
      && (!rule.scopeId || rule.scopeId === scopeId)
    );
    return !matchingRules.some((rule) => rule.effect === 'deny');
  }

  getAccountPermissions(accountId, organizationId = null) {
    const account = this.accounts.get(accountId);
    if (!account) {
      return [];
    }

    const permissionCodes = new Set();
    const now = Date.now();
    for (const assignment of this.roleAssignments.values()) {
      if (assignment.personId !== account.personId) {
        continue;
      }
      if (organizationId && assignment.organizationId !== organizationId) {
        continue;
      }
      if (assignment.endsAt && Date.parse(assignment.endsAt) < now) {
        continue;
      }
      const role = this.roles.get(assignment.roleId);
      for (const code of role?.permissions ?? []) {
        permissionCodes.add(code);
      }
      if (role?.code === 'tenant-admin') {
        for (const code of TENANT_ADMIN_PERMISSIONS) permissionCodes.add(code);
      }
    }

    for (const grant of this.permissionGrants.values()) {
      if (organizationId && grant.organizationId !== organizationId) {
        continue;
      }
      if (grant.accountId !== accountId && grant.personId !== account.personId) {
        continue;
      }
      if (grant.expiresAt && Date.parse(grant.expiresAt) < now) {
        continue;
      }
      if (grant.revokedAt) {
        continue;
      }
      const permission = this.permissions.get(grant.permissionId);
      if (permission?.code) {
        permissionCodes.add(permission.code);
      }
    }

    return Array.from(permissionCodes).sort();
  }

  assertAuthorized(identity, { organizationId = null, permissions = [] } = {}) {
    if (organizationId && !identity.organizationIds.includes(organizationId)) {
      throw new ValidationError('Cross-organization access is forbidden.');
    }

    for (const permission of permissions) {
      if (!identity.permissions.includes(permission)) {
        throw new ValidationError(`Missing permission: ${permission}`);
      }
    }
  }

  listCrudResource(resource, filters = {}) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    const collection = collectionKey ? this[collectionKey] : null;
    if (!collectionKey || !collection?.values) {
      throw new ValidationError(`Unsupported resource: ${resource}`);
    }

    const { limit, offset } = normalizePaging(filters);
    const includeArchived = filters.includeArchived === true;
    const organizationId = filters.organizationId ?? null;
    const organizationIds = Array.isArray(filters.organizationIds)
      ? filters.organizationIds.filter((value) => typeof value === 'string' && value.length > 0)
      : [];
    const scopedOrganizationIds = organizationId ? [organizationId] : organizationIds;
    const organizationResolver = RESOURCE_ORGANIZATION_RESOLVER[resource] ?? RESOURCE_ORGANIZATION_RESOLVER.default;
    const controlFields = new Set(['limit', 'offset', 'includeArchived', 'organizationId', 'organizationIds']);

    const filtered = Array.from(collection.values())
      .filter((record) => includeArchived || record.status !== 'archived')
      .filter((record) => {
        if (scopedOrganizationIds.length === 0) {
          return true;
        }

        const recordOrganizationIds = organizationResolver(record).filter(Boolean);
        return scopedOrganizationIds.some((candidateOrganizationId) =>
          recordOrganizationIds.includes(candidateOrganizationId)
        );
      })
      .filter((record) =>
        Object.entries(filters).every(([field, expectedValue]) => {
          if (controlFields.has(field) || expectedValue === undefined || expectedValue === null || expectedValue === '') {
            return true;
          }
          return matchesFilterValue(record[field], expectedValue);
        })
      )
      .sort((left, right) => Date.parse(right.updatedAt ?? right.createdAt ?? 0) - Date.parse(left.updatedAt ?? left.createdAt ?? 0));

    return {
      items: filtered.slice(offset, offset + limit),
      page: {
        total: filtered.length,
        limit,
        offset
      }
    };
  }

  getCrudResource(resource, id) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    const collection = collectionKey ? this[collectionKey] : null;
    if (!collectionKey || !collection?.has) {
      throw new ValidationError(`Unsupported resource: ${resource}`);
    }
    const record = collection.get(id);
    if (!record) {
      throw new ValidationError(`Unknown ${resource}: ${id}`);
    }
    return record;
  }

  updateCrudResource(resource, id, patch, actorId = null) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    const collection = this[collectionKey];
    if (!collectionKey || !collection?.has(id)) {
      throw new ValidationError(`Unknown ${resource}: ${id}`);
    }
    if (resource === 'accounts' && (
      Object.prototype.hasOwnProperty.call(patch, 'organizationId')
      || Object.prototype.hasOwnProperty.call(patch, 'organizationIds')
    )) {
      throw new ValidationError('Account organization memberships cannot be changed through generic updates.');
    }
    if (resource === 'referenceEntries' && collection.get(id).standard) {
      throw new ValidationError('Standard reference entries are immutable.');
    }
    if (resource === 'assignments' && ['status', 'publishedAt', 'recipientLearnerIds', 'legacyRecipientScope']
      .some((field) => Object.hasOwn(patch, field))) {
      throw new ValidationError('Assignment publication fields must be changed through the publish workflow.');
    }
    if ([
      'operatingAuthorizations',
      'accreditations',
      'institutionVerifications',
      'credentials',
      'consents',
      'documentShares',
      'collaborationRequests',
      'transfers'
    ].includes(resource)
      && (Object.prototype.hasOwnProperty.call(patch, 'status') || Object.prototype.hasOwnProperty.call(patch, 'history'))) {
      throw new ValidationError('Status and history must be changed through the dedicated transition workflow.');
    }
    const entity = collection.get(id);
    if (resource === 'organizations') {
      new Organization({
        ...cloneRecord(entity),
        ...patch,
        id: entity.id,
        lifecycle: { status: entity.status }
      });
    }
    if (resource === 'academicYears') {
      const candidate = new AcademicYear({ ...cloneRecord(entity), ...patch, id: entity.id });
      if ([...this.academicYears.values()].some((item) =>
        item.id !== id
        && item.organizationId === candidate.organizationId
        && item.code === candidate.code
        && item.status !== 'archived'
      )) {
        throw new ValidationError('Academic year code must be unique within the organization.');
      }
    }
    if (resource === 'academicPeriods') {
      const candidate = new AcademicPeriod({ ...cloneRecord(entity), ...patch, id: entity.id });
      const year = this.assertTenantRecord(this.academicYears, candidate.academicYearId, candidate.organizationId, 'academic year');
      if (Date.parse(candidate.startsOn) < Date.parse(year.startsOn)
        || Date.parse(candidate.endsOn) > Date.parse(year.endsOn)) {
        throw new ValidationError('Academic period dates must be contained within the academic year.');
      }
      if ([...this.academicPeriods.values()].some((item) =>
        item.id !== id
        && item.organizationId === candidate.organizationId
        && item.academicYearId === candidate.academicYearId
        && item.sequence === candidate.sequence
        && item.status !== 'archived'
      )) {
        throw new ValidationError('Academic period sequence must be unique within the academic year.');
      }
    }
    if (resource === 'fees') {
      new FeeConfiguration({ ...cloneRecord(entity), ...patch, id: entity.id });
    }
    if (resource === 'professionalProfiles' && patch.assignmentOrganizationIds) {
      for (const organizationId of patch.assignmentOrganizationIds) {
        this.assertExists(this.organizations, organizationId, 'assignment organization');
      }
      if (!patch.assignmentOrganizationIds.includes(entity.organizationId)) {
        throw new ValidationError('Professional profile must retain its owning organization.');
      }
    }
    const immutableReferenceFields = new Set([
      'assignmentId',
      'classId',
      'feeConfigurationId',
      'invoiceId',
      'catalogId',
      'academicProgramId',
      'courseId',
      'moduleId',
      'lessonId',
      'participantId',
      'enrollmentId',
      'quizId',
      'providerId',
      'meetingId',
      'profileId',
      'credentialId',
      'paymentId',
      'externalMeetingId',
      'parentPersonId',
      'guardianProfileId',
      'professionalProfileId',
      'subjectId',
      'academicPeriodId',
      'academicYearId',
      'programId',
      'campusId',
      'teacherAssignmentIds',
      'publicCode',
      'teacherPersonId',
      'virtualSchoolId'
      ,
      'lineageId',
      'supersedesDocumentId',
      'supersedesCredentialId',
      'fileHash',
      'hashAlgorithm',
      'verificationTokenHash',
      'publicReference',
      'templateSnapshot',
      'sourceOrganizationId',
      'destinationOrganizationId',
      'consentId',
      'tokenHash'
    ]);
    for (const field of immutableReferenceFields) {
      if (Object.prototype.hasOwnProperty.call(patch, field) && patch[field] !== entity[field]) {
        throw new ValidationError(`${field} cannot be changed after creation.`);
      }
    }

    return this.transactional(() => {
      const before = cloneRecord(entity);
      const immutableFields = new Set([
        'id',
        'organizationId',
        'organizationIds',
        'personId',
        'learnerId',
        'threadId',
        'authorPersonId'
        ,
        'targetId'
      ]);
      const institutionalCollections = new Set([
        'campuses',
        'operatingAuthorizations',
        'accreditations',
        'institutionVerifications',
        'guardianProfiles',
        'professionalProfiles',
        'guardianLearnerRelations',
        'professionalAssignments',
        'academicPeriods',
        'academicLevels',
        'subjects',
        'courses',
        'contextualPermissionRules',
        'documentTemplates',
        'documents',
        'credentials',
        'documentShares',
        'consents',
        'collaborationRequests',
        'transfers'
        ,
        'meetingProviders',
        'dataQualityRules',
        'emisProfiles',
        'referenceEntries',
        'analyticsConfigurations',
        'supportTickets',
        'saasPlans',
        'tenantSubscriptions',
        'backupConfigurations',
        'backupOperations',
        'aiAssistanceRequests',
        'incidents',
        'syncJournal'
      ]);
      const candidate = { ...entity };
      for (const [key, value] of Object.entries(patch)) {
        if (!immutableFields.has(key) && key !== 'createdAt') {
          candidate[key] = value;
        }
      }
      const validated = institutionalCollections.has(collectionKey)
        ? hydrateValue(COLLECTIONS[collectionKey], candidate)
        : Object.assign(entity, candidate);
      validated.touch?.(new Date());
      collection.set(id, validated);
      return this.recordUpdate(collectionKey, before, validated, actorId, `${resource}.update`);
    });
  }

  archiveCrudResource(resource, id, actorId = null) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    const collection = this[collectionKey];
    if (!collectionKey || !collection?.has(id)) {
      throw new ValidationError(`Unknown ${resource}: ${id}`);
    }
    if (resource === 'referenceEntries' && collection.get(id).standard) {
      throw new ValidationError('Standard reference entries are immutable.');
    }

    return this.transactional(() => {
      const entity = collection.get(id);
      const before = cloneRecord(entity);
      entity.archive?.(new Date());
      if (!entity.archive) {
        entity.status = 'archived';
        entity.archivedAt = new Date().toISOString();
        entity.updatedAt = entity.archivedAt;
      }
      return this.recordUpdate(collectionKey, before, entity, actorId, `${resource}.archive`);
    });
  }

  getCrudHistory(resource, id, filters = {}) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    if (!collectionKey) {
      throw new ValidationError(`Unsupported resource: ${resource}`);
    }
    return this.repositories[collectionKey].history(id, filters);
  }

  getAuditTrail({ organizationId = null, limit, offset } = {}) {
    const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 25));
    const normalizedOffset = Math.max(0, Number(offset) || 0);
    const params = [];
    let whereClause = '';
    if (organizationId) {
      whereClause = 'WHERE organization_id = ?';
      params.push(organizationId);
    }

    if (this.connection.isAsync) {
      return Promise.all([
        this.connection.get(`SELECT COUNT(*) AS total FROM audit_trail ${whereClause}`, params),
        this.connection.all(
          `SELECT id, organization_id, actor_id, entity_type, entity_id, action,
                  before_payload, after_payload, context_payload, reason, created_at
           FROM audit_trail ${whereClause}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, normalizedLimit, normalizedOffset]
        )
      ]).then(([totalRow, rows]) => this.formatAuditTrail(totalRow, rows, normalizedLimit, normalizedOffset));
    }

    const totalRow = this.connection.get(`SELECT COUNT(*) AS total FROM audit_trail ${whereClause}`, params);
    const rows = this.connection.all(
      `SELECT id, organization_id, actor_id, entity_type, entity_id, action,
              before_payload, after_payload, context_payload, reason, created_at
       FROM audit_trail ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, normalizedLimit, normalizedOffset]
    );

    return this.formatAuditTrail(totalRow, rows, normalizedLimit, normalizedOffset);
  }

  formatAuditTrail(totalRow, rows, normalizedLimit, normalizedOffset) {
    return {
      items: rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        actorId: row.actor_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        before: row.before_payload ? JSON.parse(row.before_payload) : null,
        after: row.after_payload ? JSON.parse(row.after_payload) : null,
        context: row.context_payload ? JSON.parse(row.context_payload) : {},
        reason: row.reason ?? null,
        timestamp: row.created_at
      })),
      page: {
        total: Number(totalRow?.total ?? 0),
        limit: normalizedLimit,
        offset: normalizedOffset
      }
    };
  }

  createOperationalRecord(collectionKey, input, actorId, action) {
    this.assertOrganizationContext(input.organizationId);
    const constructors = {
      analyticsConfigurations: AnalyticsConfiguration,
      supportTickets: SupportTicket,
      saasPlans: SaasPlan
    };
    const RecordType = constructors[collectionKey] ?? OperationalRecord;
    return this.transactional(() =>
      this.recordCreate(collectionKey, new RecordType(input), actorId, action)
    );
  }

  getRoleCodes(accountId, organizationId) {
    const account = this.accounts.get(accountId);
    if (!account) return [];
    return [...this.roleAssignments.values()]
      .filter((assignment) =>
        assignment.personId === account.personId
        && assignment.organizationId === organizationId
        && assignment.status !== 'archived'
      )
      .map((assignment) => this.roles.get(assignment.roleId)?.code)
      .filter(Boolean);
  }

  buildAnalytics({ organizationId, filters = {}, privacyMinimum = null } = {}) {
    this.assertOrganizationContext(organizationId);
    const configuration = [...this.analyticsConfigurations.values()]
      .find((item) => item.organizationId === organizationId && item.status !== 'archived');
    const minimum = Number(privacyMinimum ?? configuration?.privacyMinimum ?? 5);
    const resolveContext = (record) => {
      const enrollment = record.learnerId
        ? [...this.enrollments.values()].find((item) =>
          item.organizationId === organizationId
          && item.learnerId === record.learnerId
          && item.status !== 'archived'
        )
        : null;
      const assignment = record.assignmentId ? this.assignments.get(record.assignmentId) : null;
      const classId = record.classId ?? assignment?.classId ?? enrollment?.classId ?? null;
      const learningClass = classId ? this.classes.get(classId) : null;
      return {
        classId,
        programId: record.programId ?? learningClass?.programId ?? enrollment?.programId ?? null,
        levelCode: record.levelCode ?? learningClass?.levelCode ?? null,
        campusId: record.campusId ?? learningClass?.campusId ?? null,
        subjectId: record.subjectId ?? assignment?.subjectId ?? null
      };
    };
    const matches = (record) => {
      if (record.organizationId !== organizationId || record.status === 'archived') return false;
      const context = resolveContext(record);
      return Object.entries(filters).every(([key, value]) => {
        if (value == null || value === '') return true;
        if (key === 'period') {
          const timestamp = Date.parse(record.date ?? record.createdAt ?? 0);
          const [from, to] = String(value).split(',');
          return (!from || timestamp >= Date.parse(from)) && (!to || timestamp <= Date.parse(to));
        }
        return matchesFilterValue(record[key] ?? context[key], value);
      });
    };
    const values = {
      headcount: [...this.learners.values()].filter(matches).length,
      enrollments: [...this.enrollments.values()].filter(matches).length,
      attendance: [...this.attendance.values()].filter(matches),
      grades: [...this.grades.values()].filter(matches),
      progress: [...this.lmsProgress.values()].filter(matches),
      finance: [...this.payments.values()].filter(matches),
      lmsActivity: [...this.lmsAttempts.values()].filter(matches),
      quality: [...this.dataQualityRuns.values()].filter(matches)
    };
    const attendanceRate = values.attendance.length
      ? (values.attendance.filter((item) => !['absent', 'unexcused'].includes(item.status)).length / values.attendance.length) * 100
      : null;
    const resultAverage = values.grades.length
      ? values.grades.reduce((sum, item) => sum + ((Number(item.score) / Number(item.maxScore || 20)) * 20), 0) / values.grades.length
      : null;
    const progressionAverage = values.progress.length
      ? values.progress.reduce((sum, item) => sum + Number(item.percent ?? 0), 0) / values.progress.length
      : null;
    const metrics = {
      headcount: values.headcount,
      enrollments: values.enrollments,
      attendanceRate,
      resultAverage,
      progressionAverage,
      financeCollected: values.finance.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
      lmsActivityCount: values.lmsActivity.length,
      dataQualityScore: values.quality.at(-1)?.score ?? null
    };
    const cohortSize = Math.max(
      values.headcount,
      values.enrollments,
      new Set(values.grades.map((item) => item.learnerId)).size
    );
    const suppressed = cohortSize > 0 && cohortSize < minimum;
    const learnerResults = new Map();
    for (const grade of values.grades) {
      const current = learnerResults.get(grade.learnerId) ?? { points: 0, weight: 0 };
      const weight = Number(grade.coefficient ?? 1);
      current.points += (Number(grade.score) / Number(grade.maxScore || 20)) * 20 * weight;
      current.weight += weight;
      learnerResults.set(grade.learnerId, current);
    }
    const rankings = suppressed ? [] : [...learnerResults.entries()]
      .map(([learnerId, result]) => ({
        learnerId,
        score: result.weight ? Number((result.points / result.weight).toFixed(2)) : null
      }))
      .sort((left, right) => (right.score ?? -1) - (left.score ?? -1))
      .map((entry, index) => ({ rank: index + 1, ...entry }));
    return {
      organizationId,
      filters,
      privacy: {
        minimumCohortSize: minimum,
        suppressed,
        reason: suppressed ? 'cohort_below_privacy_threshold' : null
      },
      calculationMethods: {
        attendance: configuration?.calculationMethods?.attendance ?? 'present_or_excused_over_records',
        results: configuration?.calculationMethods?.results ?? 'normalized_mean_over_20',
        progression: configuration?.calculationMethods?.progression ?? 'mean_percent',
        finance: configuration?.calculationMethods?.finance ?? 'sum_recorded_payments'
      },
      metrics: suppressed
        ? Object.fromEntries(Object.keys(metrics).map((key) => [key, null]))
        : metrics,
      rankings: {
        scope: filters.classId ? 'class' : filters.levelCode ? 'level' : 'general',
        subjectId: filters.subjectId ?? null,
        items: rankings
      }
    };
  }

  exportAnalytics(input) {
    const report = this.buildAnalytics(input);
    const rows = Object.entries(report.metrics).map(([metric, value]) => ({
      metric,
      value,
      suppressed: report.privacy.suppressed
    }));
    if (input.format === 'csv') {
      const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `analytics-${input.organizationId}.csv`,
        body: ['metric,value,suppressed', ...rows.map((row) =>
          [row.metric, row.value, row.suppressed].map(escape).join(',')
        )].join('\n')
      };
    }
    return {
      contentType: 'application/json; charset=utf-8',
      filename: `analytics-${input.organizationId}.json`,
      body: JSON.stringify({ ...report, rows })
    };
  }

  getRoleDashboard(accountId, organizationId) {
    const permissions = this.getAccountPermissions(accountId, organizationId);
    const roles = this.getRoleCodes(accountId, organizationId);
    const role = roles[0] ?? 'learner';
    const organizationType = this.organizations.get(organizationId)?.organizationType ?? 'institution';
    const experienceRole = role === 'tenant-admin'
      ? ({ university: 'university-admin', 'training-center': 'training-center-admin', school: 'school-admin' }[organizationType] ?? 'school-admin')
      : role;
    const academicAccess = this.getAcademicAccessForAccount(accountId, organizationId);
    if (['learner', 'student', 'apprenant', 'university-student', 'etudiant-universitaire'].includes(role)
      && !academicAccess.active) {
      return {
        role,
        experienceRole,
        roles,
        academicAccess,
        cards: [],
        availableModules: ['support'],
        nextSteps: permissions.includes('*') || permissions.includes('finance.read')
          ? [{ label: 'View payment status', path: '/finance' }]
          : []
      };
    }
    const cardsByRole = {
      admin: ['headcount', 'enrollments', 'attendanceRate', 'resultAverage', 'financeCollected', 'dataQualityScore'],
      'platform-admin': ['headcount', 'enrollments', 'financeCollected', 'dataQualityScore', 'lmsActivityCount'],
      'school-admin': ['headcount', 'enrollments', 'attendanceRate', 'resultAverage', 'financeCollected', 'dataQualityScore'],
      'university-admin': ['headcount', 'enrollments', 'resultAverage', 'progressionAverage', 'financeCollected', 'dataQualityScore'],
      'training-center-admin': ['headcount', 'enrollments', 'progressionAverage', 'lmsActivityCount', 'financeCollected'],
      'tenant-admin': ['headcount', 'enrollments', 'attendanceRate', 'resultAverage', 'financeCollected', 'dataQualityScore'],
      direction: ['headcount', 'enrollments', 'attendanceRate', 'resultAverage', 'dataQualityScore'],
      teacher: ['attendanceRate', 'resultAverage', 'progressionAverage'],
      enseignant: ['attendanceRate', 'resultAverage', 'progressionAverage'],
      learner: ['resultAverage', 'attendanceRate', 'progressionAverage'],
      apprenant: ['resultAverage', 'attendanceRate', 'progressionAverage'],
      parent: ['resultAverage', 'attendanceRate', 'progressionAverage'],
      guardian: ['resultAverage', 'attendanceRate', 'progressionAverage'],
      student: ['resultAverage', 'progressionAverage', 'lmsActivityCount'],
      'university-student': ['resultAverage', 'progressionAverage', 'lmsActivityCount'],
      'etudiant-universitaire': ['resultAverage', 'progressionAverage', 'lmsActivityCount'],
      trainer: ['progressionAverage', 'lmsActivityCount'],
      formateur: ['progressionAverage', 'lmsActivityCount'],
      finance: ['enrollments', 'financeCollected'],
      support: ['dataQualityScore', 'lmsActivityCount']
    };
    const analytics = permissions.includes('*') || permissions.includes('analytics.read')
      ? this.buildAnalytics({ organizationId })
      : { metrics: {} };
    const modulePermissions = [
      ['configuration', ['organizations.read', 'institution.read', 'academics.read', 'people.read', 'profiles.read']],
      ['enrollment', ['academics.read']],
      ['teaching', ['assignments.read', 'scheduling.read']],
      ['attendance', ['attendance.read']],
      ['grading', ['grading.read']],
      ['lms', ['lms.read']],
      ['finance', ['finance.read']],
      ['documents', ['documents.read']],
      ['analytics', ['analytics.read']],
      ['support', ['support.read']],
      ['governance', ['audit.read', 'operations.read', 'security.read']]
    ];
    const nextStepDefinitions = {
      'platform-admin': [
        ['operations.read', 'Review platform operations', '/operations'],
        ['audit.read', 'Review governance events', '/audit']
      ],
      'school-admin': [
        ['academics.write', 'Configure the academic year and classes', '/academics'],
        ['academics.write', 'Import and enroll learners', '/imports'],
        ['organizations.write', 'Configure logo and signatories', '/identity-assets']
      ],
      'university-admin': [
        ['academics.write', 'Configure programs, periods and courses', '/academics'],
        ['academics.write', 'Import students', '/imports'],
        ['institution.write', 'Maintain campuses and accreditations', '/institution']
      ],
      'training-center-admin': [
        ['lms.write', 'Configure learning programs', '/lms'],
        ['academics.write', 'Import trainees and trainers', '/imports'],
        ['credentials.write', 'Configure signatories and issue titles', '/identity-assets']
      ],
      learner: [
        ['assignments.read', 'Review assignments', '/assignments'],
        ['lms.read', 'Continue learning', '/learning-path'],
        ['documents.read', 'Open documents', '/documents'],
        ['people.read', 'Review profile preferences', '/profile']
      ],
      student: [
        ['lms.read', 'Continue a course', '/learning-path'],
        ['grading.read', 'Review results', '/grading'],
        ['calendar.read', 'View the calendar', '/calendar']
      ],
      teacher: [
        ['attendance.write', 'Record attendance', '/attendance'],
        ['grading.write', 'Enter grades', '/grading'],
        ['assignments.write', 'Prepare an assignment', '/assignments']
      ],
      trainer: [
        ['lms.write', 'Update course content', '/lms'],
        ['credentials.write', 'Review title eligibility', '/learning-path'],
        ['grading.write', 'Assess trainees', '/grading'],
        ['attendance.write', 'Record attendance', '/attendance']
      ],
      parent: [
        ['attendance.read', 'Review attendance', '/attendance'],
        ['grading.read', 'Review results', '/grading'],
        ['communications.read', 'Contact the institution', '/communications']
      ],
      guardian: [
        ['attendance.read', 'Review attendance', '/attendance'],
        ['communications.read', 'Contact the institution', '/communications']
      ]
    };
    const allowed = (permission) => permissions.includes('*') || permissions.includes(permission);
    return {
      role,
      experienceRole,
      roles,
      academicAccess,
      cards: (cardsByRole[experienceRole] ?? cardsByRole[role] ?? cardsByRole.learner)
        .filter((metric) => Object.hasOwn(analytics.metrics, metric))
        .map((metric) => ({ metric, value: analytics.metrics[metric] })),
      availableModules: modulePermissions
        .filter(([, required]) => required.some(allowed))
        .map(([module]) => module),
      nextSteps: (nextStepDefinitions[experienceRole] ?? nextStepDefinitions[role] ?? nextStepDefinitions.learner)
        .filter(([permission]) => allowed(permission))
        .map(([, label, path]) => ({ label, path }))
    };
  }

  getAcademicAccessForAccount(accountId, organizationId) {
    const account = this.accounts.get(accountId);
    if (!account || !account.organizationIds.includes(organizationId)) {
      return { active: false, reason: 'not_enrolled', policy: null };
    }
    const subscriptions = [...this.platformSubscriptions.values()]
      .filter((item) => item.organizationId === organizationId && item.status !== 'archived')
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    if (subscriptions.length > 0 && subscriptions[0].status !== 'active') {
      return { active: false, reason: 'subscription_suspended', policy: subscriptions[0].plan };
    }
    const learnerFacingRoles = new Set([
      'learner',
      'student',
      'trainee',
      'apprenant',
      'university-student',
      'etudiant-universitaire',
      'parent',
      'guardian'
    ]);
    const roleCodes = this.getRoleCodes(accountId, organizationId);
    if (roleCodes.some((roleCode) => !learnerFacingRoles.has(roleCode))) {
      return { active: true, reason: 'operational_role', policy: null };
    }
    let learner = [...this.learners.values()].find((item) =>
      item.organizationId === organizationId && item.personId === account.personId && item.status !== 'archived'
    );
    if (!learner) {
      const guardianProfile = [...this.guardianProfiles.values()].find((item) =>
        item.organizationId === organizationId && item.personId === account.personId && item.status !== 'archived'
      );
      const relation = guardianProfile && [...this.guardianLearnerRelations.values()].find((item) =>
        item.organizationId === organizationId
        && item.guardianProfileId === guardianProfile.id
        && item.status !== 'withdrawn'
      );
      learner = relation ? this.learners.get(relation.learnerId) : null;
    }
    if (!learner) return { active: true, reason: 'not_learner', policy: null };
    const enrollment = [...this.enrollments.values()].find((item) =>
      item.organizationId === organizationId && item.learnerId === learner.id && item.status === 'active'
    );
    if (!enrollment) return { active: false, reason: 'no_active_enrollment', policy: null };
    const policies = [...this.fees.values()].filter((item) =>
      item.organizationId === organizationId
      && (!item.programId || item.programId === enrollment.programId)
      && item.status !== 'archived'
    );
    const policy = policies.find((item) => item.programId === enrollment.programId) ?? policies[0] ?? null;
    if (!policy || policy.freeTraining || policy.accessPolicy === 'no_payment_required') {
      return {
        active: true,
        reason: policy?.freeTraining ? 'free_training' : 'no_payment_required',
        policy: policy?.accessPolicy ?? 'no_payment_required'
      };
    }
    const invoices = [...this.invoices.values()].filter((item) =>
      item.organizationId === organizationId
      && item.learnerId === learner.id
      && item.feeConfigurationId === policy.id
      && item.status !== 'archived'
    );
    const invoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const paid = invoices.reduce((sum, invoice) => sum + (invoice.amount - invoice.balance), 0);
    const percentage = invoiced > 0 ? (paid / invoiced) * 100 : 0;
    const active = policy.accessPolicy === 'registration_fee_paid'
      ? paid > 0
      : policy.accessPolicy === 'minimum_percentage'
        ? percentage >= policy.minimumPercentage
        : policy.accessPolicy === 'minimum_amount'
          ? paid >= policy.minimumAmount
          : policy.accessPolicy === 'fully_paid'
            ? invoiced > 0 && invoices.every((invoice) => invoice.balance === 0)
            : false;
    return {
      active,
      reason: active ? 'payment_criteria_satisfied' : 'payment_pending',
      policy: policy.accessPolicy,
      paid,
      invoiced,
      percentage: Number(percentage.toFixed(2)),
      requiredPercentage: policy.minimumPercentage,
      requiredAmount: policy.minimumAmount
    };
  }

  async enrollMfa(accountId, currentCode = null) {
    if (!this.accounts.has(accountId)) throw new ValidationError(`Unknown account: ${accountId}`);
    const existing = await this.connection.get(
      'SELECT state FROM mfa_settings WHERE account_id = ?',
      [accountId]
    );
    if (existing?.state === 'enabled') {
      if (!currentCode) throw new ValidationError('Current MFA code is required to replace an enabled factor.');
      await this.verifyMfaCode(accountId, currentCode);
    }
    const secret = createTotpSecret();
    const recoveryCodes = createRecoveryCodes();
    await this.connection.run(
      `INSERT INTO mfa_settings(
         account_id, encrypted_secret, recovery_hashes, pending_encrypted_secret,
         pending_recovery_hashes, state, enrolled_at, confirmed_at, disabled_at
       ) VALUES (?, '', '[]', ?, ?, 'pending', ?, NULL, NULL)
       ON CONFLICT(account_id) DO UPDATE SET
         pending_encrypted_secret = excluded.pending_encrypted_secret,
         pending_recovery_hashes = excluded.pending_recovery_hashes,
         state = CASE WHEN mfa_settings.state = 'enabled' THEN 'enabled' ELSE 'pending' END,
         enrolled_at = excluded.enrolled_at, disabled_at = NULL`,
      [
        accountId,
        encryptMfaSecret(secret),
        JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
        new Date().toISOString()
      ]
    );
    const account = this.accounts.get(accountId);
    return {
      secret,
      recoveryCodes,
      otpauthUri: `otpauth://totp/Eduplateforme:${encodeURIComponent(account.username)}?secret=${secret}&issuer=Eduplateforme`
    };
  }

  async confirmMfa(accountId, code) {
    const row = await this.connection.get(
      'SELECT pending_encrypted_secret, state FROM mfa_settings WHERE account_id = ?',
      [accountId]
    );
    if (!row?.pending_encrypted_secret
      || !['pending', 'enabled'].includes(row.state)
      || !verifyTotp(decryptMfaSecret(row.pending_encrypted_secret), code)) {
      throw new ValidationError('MFA confirmation code is invalid.');
    }
    await this.connection.run(
      `UPDATE mfa_settings SET state = 'enabled',
         encrypted_secret = pending_encrypted_secret,
         recovery_hashes = pending_recovery_hashes,
         pending_encrypted_secret = NULL,
         pending_recovery_hashes = NULL,
         confirmed_at = ?
       WHERE account_id = ?`,
      [new Date().toISOString(), accountId]
    );
    await this.writeAuditEntry({
      actorId: accountId,
      entityType: 'MfaSetting',
      entityId: accountId,
      action: 'mfa.enabled'
    });
    return { enabled: true };
  }

  async disableMfa(accountId, code) {
    await this.verifyMfaCode(accountId, code);
    await this.connection.run(
      `UPDATE mfa_settings SET state = 'disabled', encrypted_secret = '', recovery_hashes = '[]',
         pending_encrypted_secret = NULL, pending_recovery_hashes = NULL, disabled_at = ?
       WHERE account_id = ?`,
      [new Date().toISOString(), accountId]
    );
    await this.writeAuditEntry({
      actorId: accountId,
      entityType: 'MfaSetting',
      entityId: accountId,
      action: 'mfa.disabled'
    });
    return { enabled: false };
  }

  async verifyMfaCode(accountId, code) {
    const row = await this.connection.get(
      "SELECT encrypted_secret, recovery_hashes FROM mfa_settings WHERE account_id = ? AND state = 'enabled'",
      [accountId]
    );
    if (!row) throw new ValidationError('MFA is not enabled.');
    const validTotp = verifyTotp(decryptMfaSecret(row.encrypted_secret), code);
    const recoveryHashes = JSON.parse(row.recovery_hashes);
    const suppliedHash = hashRecoveryCode(code);
    const recoveryIndex = recoveryHashes.indexOf(suppliedHash);
    if (!validTotp && recoveryIndex < 0) throw new ValidationError('MFA code is invalid.');
    if (recoveryIndex >= 0) {
      recoveryHashes.splice(recoveryIndex, 1);
      await this.connection.run(
        'UPDATE mfa_settings SET recovery_hashes = ? WHERE account_id = ?',
        [JSON.stringify(recoveryHashes), accountId]
      );
    }
    return true;
  }

  async completeMfaChallenge(challengeToken, code) {
    const challenge = verifyJwt(challengeToken);
    if (!challenge || challenge.purpose !== 'mfa-challenge') {
      throw new ValidationError('MFA challenge is invalid or expired.');
    }
    await this.verifyMfaCode(challenge.sub, code);
    const account = this.accounts.get(challenge.sub);
    if (!account) throw new ValidationError('MFA challenge account is invalid.');
    await this.writeAuditEntry({
      actorId: account.id,
      organizationId: challenge.organizationId ?? null,
      entityType: 'UserAccount',
      entityId: account.id,
      action: 'auth.mfa-verified'
    });
    return this.createAuthenticationSession(account, challenge.organizationId ?? null);
  }

  async listSessions(accountId) {
    const rows = await this.connection.all(
      `SELECT token_id, organization_id, expires_at, revoked_at, created_at
       FROM refresh_tokens WHERE account_id = ? ORDER BY created_at DESC`,
      [accountId]
    );
    return rows.map((row) => ({
      id: row.token_id,
      organizationId: row.organization_id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at
    }));
  }

  async revokeSession(accountId, tokenId) {
    await this.connection.run(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND token_id = ? AND revoked_at IS NULL',
      [new Date().toISOString(), accountId, tokenId]
    );
    return { revoked: true, sessionId: tokenId };
  }

  async requestBackup(input, actorId) {
    const adapter = this.externalAdapters.backup;
    const operation = await this.createOperationalRecord('backupOperations', {
      organizationId: input.organizationId,
      operationType: input.operationType ?? 'backup',
      rpoHours: Number(input.rpoHours ?? 24),
      rtoHours: Number(input.rtoHours ?? 8),
      integrityState: 'not_tested',
      operationState: adapter ? 'running' : 'pending_external'
    }, actorId, 'backup.request');
    if (!adapter) return operation;
    try {
      const result = await adapter.execute({ ...input, operationId: operation.id });
      const before = cloneRecord(operation);
      operation.operationState = 'completed';
      operation.externalReference = result.externalReference ?? null;
      operation.integrityState = result.integrityState ?? 'not_tested';
      operation.touch();
      await this.recordUpdate('backupOperations', before, operation, actorId, 'backup.complete');
    } catch (error) {
      const before = cloneRecord(operation);
      operation.operationState = 'failed';
      operation.failureReason = String(error.message);
      operation.touch();
      await this.recordUpdate('backupOperations', before, operation, actorId, 'backup.fail');
    }
    return operation;
  }

  async addSupportComment(ticketId, input, actorId) {
    const ticket = this.supportTickets.get(ticketId);
    if (!ticket) throw new ValidationError(`Unknown support ticket: ${ticketId}`);
    const before = cloneRecord(ticket);
    const comment = {
      id: createPermanentId(),
      authorId: actorId,
      message: String(input.message ?? '').trim(),
      createdAt: new Date().toISOString()
    };
    if (!comment.message) throw new ValidationError('message is required.');
    ticket.comments.push(comment);
    if (input.ticketState) ticket.ticketState = input.ticketState;
    if (input.supportLevel) ticket.supportLevel = input.supportLevel;
    ticket.history.push({
      at: comment.createdAt,
      actorId,
      ticketState: ticket.ticketState,
      supportLevel: ticket.supportLevel
    });
    ticket.touch();
    await this.recordUpdate('supportTickets', before, ticket, actorId, 'support.comment');
    return ticket;
  }

  checkEntitlement(organizationId, feature, { additionalUsers = 0, additionalStorageBytes = 0 } = {}) {
    const subscription = [...this.tenantSubscriptions.values()]
      .find((item) => item.organizationId === organizationId && item.subscriptionState === 'active');
    const plan = subscription ? this.saasPlans.get(subscription.planId) : null;
    if (!plan) return { allowed: false, reason: 'no_active_plan' };
    if (!plan.features.includes(feature)) return { allowed: false, reason: 'feature_not_in_plan' };
    const users = [...this.accounts.values()].filter((account) => account.organizationIds.includes(organizationId)).length;
    const storage = [...this.documents.values()]
      .filter((document) => document.organizationId === organizationId)
      .reduce((sum, document) => sum + Number(document.sizeBytes ?? 0), 0);
    if ((users + Number(additionalUsers)) > plan.userQuota) return { allowed: false, reason: 'user_quota_exceeded' };
    if ((storage + Number(additionalStorageBytes)) > plan.storageQuotaBytes) return { allowed: false, reason: 'storage_quota_exceeded' };
    return {
      allowed: true,
      planCode: plan.code,
      usage: { users, storageBytes: storage },
      quotas: { users: plan.userQuota, storageBytes: plan.storageQuotaBytes }
    };
  }

  async requestAiAssistance(input, actorId) {
    this.assertOrganizationContext(input.organizationId);
    const requestedAction = String(input.requestedAction ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (HIGH_IMPACT_AI_ACTIONS.includes(requestedAction)) {
      throw new ValidationError('AI assistance cannot make or recommend autonomous high-impact decisions.');
    }
    if (!SAFE_AI_ASSISTANCE_ACTIONS.includes(requestedAction)) {
      throw new ValidationError('requestedAction is not an allowed assistive action.');
    }
    if (input.consent !== true) throw new ValidationError('Explicit consent is required for AI assistance.');
    const prompt = String(input.prompt ?? '').trim();
    if (!prompt) throw new ValidationError('prompt is required.');
    const adapter = this.externalAdapters.ai;
    const request = await this.createOperationalRecord('aiAssistanceRequests', {
      ...input,
      requestedAction,
      prompt,
      assistanceState: adapter ? 'processing' : 'pending_external',
      providerConfigured: Boolean(adapter),
      decisionAuthority: 'human'
    }, actorId, 'ai-assistance.request');
    if (!adapter) return request;
    const response = await adapter.assist({
      prompt: request.prompt,
      context: input.context ?? {},
      prohibitedActions: HIGH_IMPACT_AI_ACTIONS
    });
    const before = cloneRecord(request);
    request.assistanceState = 'completed';
    request.response = response.text;
    request.touch();
    await this.recordUpdate('aiAssistanceRequests', before, request, actorId, 'ai-assistance.complete');
    return request;
  }

  async processOfflineMutations({ organizationId, mutations }, actorId) {
    this.assertOrganizationContext(organizationId);
    if (!Array.isArray(mutations)) throw new ValidationError('mutations must be an array.');
    const results = [];
    for (const mutation of mutations) {
      const idempotencyKey = String(mutation.idempotencyKey ?? '');
      if (!idempotencyKey) throw new ValidationError('Each offline mutation requires idempotencyKey.');
      const previous = await this.connection.get(
        'SELECT result_payload FROM offline_mutations WHERE organization_id = ? AND idempotency_key = ?',
        [organizationId, idempotencyKey]
      );
      if (previous) {
        results.push({ ...JSON.parse(previous.result_payload), replayed: true });
        continue;
      }
      if (['grades', 'credentials', 'documents', 'disciplineRecords', 'payments'].includes(mutation.resource)) {
        results.push({ idempotencyKey, state: 'requires_online_confirmation', resource: mutation.resource });
        continue;
      }
      if (!['supportTickets', 'lmsProgress'].includes(mutation.resource)) {
        results.push({ idempotencyKey, state: 'rejected', reason: 'offline_mutation_not_allowed' });
        continue;
      }
      const record = this[mutation.resource]?.get(mutation.entityId);
      if (mutation.resource === 'supportTickets' && !record) {
        results.push({ idempotencyKey, state: 'rejected', reason: 'resource_not_found' });
        continue;
      }
      if (record && record.organizationId !== organizationId) {
        results.push({ idempotencyKey, state: 'rejected', reason: 'cross_tenant_resource' });
        continue;
      }
      if (record && mutation.expectedUpdatedAt && String(record.updatedAt) !== String(mutation.expectedUpdatedAt)) {
        results.push({ idempotencyKey, state: 'conflict', serverUpdatedAt: record.updatedAt });
        continue;
      }
      let result;
      if (mutation.resource === 'supportTickets' && mutation.action === 'comment') {
        result = await this.addSupportComment(mutation.entityId, mutation.payload, actorId);
      } else {
        result = await this.createPlatformRecord('lmsProgress', {
          ...mutation.payload,
          organizationId
        }, actorId);
      }
      const outcome = { idempotencyKey, state: 'applied', entityId: result.id };
      await this.connection.run(
        `INSERT INTO offline_mutations(organization_id, idempotency_key, actor_id, resource, entity_id, result_payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [organizationId, idempotencyKey, actorId, mutation.resource, result.id, JSON.stringify(outcome), new Date().toISOString()]
      );
      results.push(outcome);
    }
    return { organizationId, results, synchronizedAt: new Date().toISOString() };
  }

  async readinessCheck() {
    try {
      await this.connection.ping();
      return { status: 'ready', database: this.connection.dialect };
    } catch {
      return { status: 'not_ready', database: 'unavailable' };
    }
  }

  async getMetrics() {
    const activeSessions = await this.connection.get(
      'SELECT COUNT(*) AS total FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > ?',
      [new Date().toISOString()]
    );
    return {
      process_uptime_seconds: Math.floor(process.uptime()),
      eduplateforme_active_sessions: Number(activeSessions?.total ?? 0),
      eduplateforme_organizations: this.organizations.size,
      eduplateforme_audit_events: Number((await this.connection.get('SELECT COUNT(*) AS total FROM audit_trail'))?.total ?? 0)
    };
  }

  async healthCheck() {
    await this.connection.ping();
    return {
      status: 'ok',
      database: this.connection.dialect
    };
  }

  async close() {
    await this.connection.close();
  }
}

export function createPersistentEducationPlatformService(options = {}) {
  return new PersistentEducationPlatformService(options);
}

export async function initializePersistentEducationPlatformService(options = {}) {
  const connection = options.connection ?? await openDatabaseConnection({ url: options.databaseUrl });
  const service = new PersistentEducationPlatformService({
    ...options,
    connection,
    deferHydration: true
  });
  await service.hydrateState();
  return service;
}
