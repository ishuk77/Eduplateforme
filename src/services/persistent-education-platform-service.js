import { createHash, randomUUID } from 'node:crypto';

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
import { CredentialRecord, DocumentRecord } from '../domain/documents/documents.js';
import { FeeConfiguration, Invoice, Payment } from '../domain/finance/finance.js';
import { GradeEntry, GradingSystem } from '../domain/grading/grading.js';
import { LocalizationProfile } from '../domain/i18n/i18n.js';
import { Notification } from '../domain/notifications/notifications.js';
import { Organization } from '../domain/organizations/organization.js';
import { Person } from '../domain/people/person.js';
import { ReportCard } from '../domain/reports/reports.js';
import { ScheduleEntry } from '../domain/scheduling/scheduling.js';
import { PlatformSubscription } from '../domain/subscriptions/subscriptions.js';
import { VirtualSchool, PaidTraining } from '../domain/virtual-schools/virtual-schools.js';
import { createPermanentId, ValidationError } from '../shared/entity.js';
import { createDatabaseConnection } from '../db/connection.js';
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

const COLLECTIONS = {
  organizations: { hydrate: (value) => new Organization(value), repository: (connection) => new OrganizationRepository({ connection }) },
  people: { hydrate: (value) => new Person(value), repository: (connection) => new PersonRepository({ connection }) },
  accounts: { hydrate: (value) => new UserAccount(value), repository: (connection) => new UserAccountRepository({ connection }) },
  permissions: { hydrate: (value) => new Permission(value) },
  roles: { hydrate: (value) => new Role(value) },
  roleAssignments: { hydrate: (value) => new RoleAssignment(value) },
  permissionGrants: { hydrate: (value) => new PermissionGrant(value) },
  learners: { hydrate: (value) => new Learner(value) },
  academicYears: { hydrate: (value) => new AcademicYear(value) },
  programs: { hydrate: (value) => new Program(value) },
  classes: { hydrate: (value) => new LearningClass(value) },
  enrollments: { hydrate: (value) => new Enrollment(value) },
  documents: { hydrate: (value) => new DocumentRecord(value) },
  credentials: { hydrate: (value) => new CredentialRecord(value) },
  gradingSystems: { hydrate: (value) => new GradingSystem(value) },
  grades: { hydrate: (value) => new GradeEntry(value), repository: (connection) => new GradeRepository({ connection }), sensitive: true },
  attendance: { hydrate: (value) => new AttendanceRecord(value), repository: (connection) => new AttendanceRepository({ connection }) },
  scheduleEntries: { hydrate: (value) => new ScheduleEntry(value) },
  assignments: { hydrate: (value) => new Assignment(value), repository: (connection) => new AssignmentRepository({ connection }) },
  assignmentSubmissions: { hydrate: (value) => new AssignmentSubmission(value) },
  reportCards: { hydrate: (value) => new ReportCard(value) },
  fees: { hydrate: (value) => new FeeConfiguration(value) },
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
  localizationProfiles: { hydrate: (value) => new LocalizationProfile(value), keySelector: (value) => value.organizationId },
  platformSubscriptions: { hydrate: (value) => new PlatformSubscription(value), repository: (connection) => new SubscriptionRepository({ connection }) },
  parentalConsents: { hydrate: (value) => ({ ...value }) },
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
  attendance: 'attendance',
  assignments: 'assignments',
  reports: 'reportCards',
  communicationsThreads: 'threads',
  communicationsMessages: 'messages',
  discipline: 'disciplineRecords',
  calendar: 'calendarEvents',
  subscriptions: 'platformSubscriptions',
  financeFees: 'fees',
  financeInvoices: 'invoices',
  financePayments: 'payments'
};

const RESOURCE_ORGANIZATION_RESOLVER = {
  organizations: (record) => [record.id],
  people: (record) => [record.primaryOrganizationId ?? null],
  accounts: (record) => Array.isArray(record.organizationIds) ? record.organizationIds : [record.organizationId ?? null],
  default: (record) => [record.organizationId ?? null]
};

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

    this.hydrateState();
  }

  hydrateState() {
    for (const [collectionKey, definition] of Object.entries(COLLECTIONS)) {
      const values = this.repositories[collectionKey].loadAll().map((value) => hydrateValue(definition, value));
      if (definition.isArray) {
        this[collectionKey] = values;
        continue;
      }

      const keySelector = definition.keySelector ?? ((value) => value.id);
      this[collectionKey] = new Map(values.map((value) => [keySelector(value), value]));
    }
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

    this.repositories[collectionKey].upsert(normalizedRecord, { actorId, action });
    if (collectionKey === 'localizationProfiles') {
      upsertMapValue(this.localizationProfiles, normalizedRecord, (value) => value.organizationId);
      return;
    }

    if (collectionKey === 'events') {
      return;
    }

    upsertMapValue(this[collectionKey], normalizedRecord);
  }

  recordEvent(type, subject, actorId = null, payload = {}, options = {}) {
    const event = FoundationService.prototype.recordEvent.call(this, type, subject, actorId, payload, options);
    this.repositories.events.upsert(event, { actorId, action: type });
    return event;
  }

  writeAuditEntry({ actorId = null, organizationId = null, entityType, entityId, action, before = null, after = null }) {
    this.connection.run(
      `INSERT INTO audit_trail(id, organization_id, actor_id, entity_type, entity_id, action, before_payload, after_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createPermanentId(),
        organizationId,
        actorId,
        entityType,
        entityId,
        action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
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

  recordUpdate(collectionKey, before, after, actorId, action) {
    this.persistRecord(collectionKey, after, { actorId, action });
    this.writeAuditEntry({
      actorId,
      organizationId: after.organizationId ?? before?.organizationId ?? null,
      entityType: after.constructor?.name ?? collectionKey,
      entityId: after.id,
      action,
      before,
      after: cloneRecord(after)
    });
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

  registerDocument(input, actorId = null) {
    return this.transactional(() => this.recordCreate('documents', super.registerDocument(input, actorId), actorId, 'document.create'));
  }

  registerDocumentVersion(previousDocumentId, input = {}, actorId = null) {
    return this.transactional(() => {
      const previous = cloneRecord(this.documents.get(previousDocumentId));
      const document = super.registerDocumentVersion(previousDocumentId, input, actorId);
      this.recordUpdate('documents', previous, this.documents.get(previousDocumentId), actorId, 'document.supersede');
      return this.recordCreate('documents', document, actorId, 'document.version');
    });
  }

  issueCredential(input, actorId = null) {
    return this.transactional(() => this.recordCreate('credentials', super.issueCredential(input, actorId), actorId, 'credential.create'));
  }

  issueCredentialRevision(previousCredentialId, input = {}, actorId = null) {
    return this.transactional(() => {
      const previous = cloneRecord(this.credentials.get(previousCredentialId));
      const credential = super.issueCredentialRevision(previousCredentialId, input, actorId);
      this.recordUpdate('credentials', previous, this.credentials.get(previousCredentialId), actorId, 'credential.supersede');
      return this.recordCreate('credentials', credential, actorId, 'credential.version');
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
      const profile = super.upsertLocalizationProfile(input, actorId);
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

  authenticate({ username, password, organizationId = null }) {
    const account = Array.from(this.accounts.values()).find((candidate) =>
      candidate.username.toLowerCase() === String(username).toLowerCase()
      || candidate.email === String(username).toLowerCase()
      || candidate.loginIdentifiers.some((identifier) => identifier.value === String(username).toLowerCase())
    );

    if (!account) {
      throw new ValidationError('Invalid username or password.');
    }

    const credentials = this.connection.get('SELECT password_hash FROM auth_credentials WHERE account_id = ?', [account.id]);
    if (!verifyPassword(password, credentials?.password_hash)) {
      throw new ValidationError('Invalid username or password.');
    }

    if (account.status !== 'active') {
      account.activate();
      this.persistRecord('accounts', account, { actorId: account.id, action: 'account.activate' });
    }

    const resolvedOrganizationId = organizationId ?? account.organizationIds[0] ?? null;
    if (resolvedOrganizationId && !account.organizationIds.includes(resolvedOrganizationId)) {
      throw new ValidationError('Account is not allowed to access this organization.');
    }

    const permissions = this.getAccountPermissions(account.id, resolvedOrganizationId);
    const refreshToken = createRefreshToken();
    const tokenId = randomUUID();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + (1000 * 60 * 60 * 24 * 30)).toISOString();
    this.connection.run(
      `INSERT INTO refresh_tokens(token_id, account_id, organization_id, refresh_token_hash, expires_at, revoked_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [tokenId, account.id, resolvedOrganizationId, hashToken(refreshToken), refreshExpiresAt, now.toISOString()]
    );

    const accessToken = signJwt({
      sub: account.id,
      personId: account.personId,
      organizationId: resolvedOrganizationId,
      organizationIds: account.organizationIds,
      permissions,
      username: account.username
    }, { expiresInSeconds: 60 * 60 * 24 });

    this.writeAuditEntry({
      actorId: account.id,
      organizationId: resolvedOrganizationId,
      entityType: 'UserAccount',
      entityId: account.id,
      action: 'auth.login',
      after: { organizationId: resolvedOrganizationId }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 60 * 60 * 24,
      user: this.getAuthenticatedUserByAccountId(account.id, resolvedOrganizationId)
    };
  }

  refreshAuthentication(refreshToken) {
    const row = this.connection.get(
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

  logout(refreshToken, accountId = null) {
    const params = [new Date().toISOString(), hashToken(refreshToken)];
    let sql = 'UPDATE refresh_tokens SET revoked_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL';
    if (accountId) {
      sql += ' AND account_id = ?';
      params.push(accountId);
    }

    this.connection.run(sql, params);
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
      profile: person ? { givenName: person.givenName, familyName: person.familyName } : null
    };
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

    return this.transactional(() => {
      const entity = collection.get(id);
      const before = cloneRecord(entity);
      const immutableFields = new Set(['id', 'organizationId', 'personId', 'learnerId', 'threadId', 'authorPersonId']);
      for (const [key, value] of Object.entries(patch)) {
        if (!immutableFields.has(key) && key !== 'createdAt') {
          entity[key] = value;
        }
      }
      entity.touch?.(new Date());
      return this.recordUpdate(collectionKey, before, entity, actorId, `${resource}.update`);
    });
  }

  archiveCrudResource(resource, id, actorId = null) {
    const collectionKey = RESOURCE_TO_COLLECTION[resource];
    const collection = this[collectionKey];
    if (!collectionKey || !collection?.has(id)) {
      throw new ValidationError(`Unknown ${resource}: ${id}`);
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

    const totalRow = this.connection.get(`SELECT COUNT(*) AS total FROM audit_trail ${whereClause}`, params);
    const rows = this.connection.all(
      `SELECT id, organization_id, actor_id, entity_type, entity_id, action, before_payload, after_payload, created_at
       FROM audit_trail ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, normalizedLimit, normalizedOffset]
    );

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
        timestamp: row.created_at
      })),
      page: {
        total: Number(totalRow?.total ?? 0),
        limit: normalizedLimit,
        offset: normalizedOffset
      }
    };
  }
}

export function createPersistentEducationPlatformService(options = {}) {
  return new PersistentEducationPlatformService(options);
}
