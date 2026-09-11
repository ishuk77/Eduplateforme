import { FoundationService, FOUNDATION_INVARIANTS, FOUNDATION_PHASES } from '../application/foundation-service.js';
import { GradeEntry, GradingSystem } from '../domain/grading/grading.js';
import { AttendanceRecord } from '../domain/attendance/attendance.js';
import { ScheduleEntry } from '../domain/scheduling/scheduling.js';
import { Assignment, AssignmentSubmission } from '../domain/assignments/assignments.js';
import { ReportCard } from '../domain/reports/reports.js';
import { FeeConfiguration, Invoice, Payment } from '../domain/finance/finance.js';
import { Notification } from '../domain/notifications/notifications.js';
import { DiscussionThread, ThreadMessage } from '../domain/communications/communications.js';
import { DisciplineRecord } from '../domain/discipline/discipline.js';
import { CalendarEvent } from '../domain/calendar/calendar.js';
import { VirtualSchool, PaidTraining } from '../domain/virtual-schools/virtual-schools.js';
import { Certificate } from '../domain/certificates/certificates.js';
import { PlatformSubscription } from '../domain/subscriptions/subscriptions.js';
import { LocalizationProfile } from '../domain/i18n/i18n.js';
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
  Subject
} from '../domain/institutional/institutional.js';
import {
  CollaborationRequest,
  ConsentRecord,
  DocumentShare,
  DocumentTemplate,
  TransferRecord
} from '../domain/documents/documents.js';
import { ValidationError, createPermanentId } from '../shared/entity.js';
import {
  DataQualityRule,
  EmisProfile,
  ExternalProvider,
  PlatformRecord,
  ReferenceEntry
} from '../domain/learning-systems/learning-systems.js';

const PLATFORM_RESOURCE_COLLECTIONS = Object.freeze({
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
  userLocalizationProfiles: 'userLocalizationProfiles'
});

const REQUIRED_FIELDS = Object.freeze({
  lmsCatalogs: ['code', 'name'],
  lmsPrograms: ['catalogId', 'academicProgramId', 'code', 'title'],
  lmsCourses: ['programId', 'academicCourseId', 'code', 'title'],
  lmsModules: ['courseId', 'title', 'position'],
  lmsLessons: ['moduleId', 'title', 'position'],
  lmsResources: ['lessonId', 'title', 'externalReference'],
  lmsParticipants: ['personId', 'role'],
  lmsEnrollments: ['participantId', 'programId'],
  lmsProgress: ['enrollmentId', 'lessonId'],
  lmsQuizzes: ['courseId', 'title', 'passingScore'],
  lmsQuestions: ['quizId', 'prompt', 'questionType', 'correctAnswer'],
  lmsAssessments: ['courseId', 'title', 'assessmentType'],
  lmsPayments: ['enrollmentId', 'invoiceId'],
  lmsCertificates: ['enrollmentId', 'credentialId'],
  meetings: ['providerId', 'externalMeetingId', 'externalUrl', 'startsAt', 'timezone'],
  meetingParticipants: ['meetingId', 'personId', 'role'],
  meetingAttendance: ['meetingId', 'personId'],
  emisMappings: ['profileId', 'sourceField', 'targetField'],
  emisNationalReferences: ['profileId', 'catalog', 'code', 'label'],
  emisExchanges: ['profileId', 'direction'],
  referenceEntries: ['catalog', 'code', 'labels'],
  userLocalizationProfiles: ['userId', 'countryCode', 'language', 'currency', 'timezone']
});

const STANDARD_REFERENCES = Object.freeze([
  { catalog: 'countries', code: 'FR', labels: { fr: 'France', en: 'France' } },
  { catalog: 'countries', code: 'SN', labels: { fr: 'Sénégal', en: 'Senegal' } },
  { catalog: 'countries', code: 'CD', labels: { fr: 'République démocratique du Congo', en: 'Democratic Republic of the Congo' } },
  { catalog: 'currencies', code: 'EUR', labels: { fr: 'Euro', en: 'Euro' } },
  { catalog: 'currencies', code: 'USD', labels: { fr: 'Dollar américain', en: 'US dollar' } },
  { catalog: 'currencies', code: 'XOF', labels: { fr: 'Franc CFA BCEAO', en: 'West African CFA franc' } },
  { catalog: 'timezones', code: 'UTC', labels: { fr: 'Temps universel coordonné', en: 'Coordinated Universal Time' } },
  { catalog: 'timezones', code: 'Africa/Dakar', labels: { fr: 'Dakar', en: 'Dakar' } },
  { catalog: 'languages', code: 'fr', labels: { fr: 'Français', en: 'French' } },
  { catalog: 'languages', code: 'en', labels: { fr: 'Anglais', en: 'English' } },
  { catalog: 'isced', code: 'ISCED-1', labels: { fr: 'Enseignement primaire', en: 'Primary education' } },
  { catalog: 'isced', code: 'ISCED-2', labels: { fr: 'Premier cycle du secondaire', en: 'Lower secondary education' } },
  { catalog: 'administrative-levels', code: 'ADM1', labels: { fr: 'Premier niveau administratif', en: 'First administrative level' } },
  { catalog: 'education-systems', code: 'GENERAL', labels: { fr: 'Enseignement général', en: 'General education' } },
  { catalog: 'levels', code: 'PRIMARY', labels: { fr: 'Primaire', en: 'Primary' } },
  { catalog: 'programs', code: 'GENERAL', labels: { fr: 'Programme général', en: 'General program' } },
  { catalog: 'qualifications', code: 'CERTIFICATE', labels: { fr: 'Certificat', en: 'Certificate' } },
  { catalog: 'grading-scales', code: 'PERCENT', labels: { fr: 'Pourcentage', en: 'Percentage' } },
  { catalog: 'institution-codes', code: 'NATIONAL', labels: { fr: 'Identifiant national', en: 'National identifier' } },
  { catalog: 'subjects', code: 'MATHEMATICS', labels: { fr: 'Mathématiques', en: 'Mathematics' } }
]);

function paginate(items, { limit = 25, offset = 0 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  const normalizedOffset = Math.max(0, Number(offset) || 0);
  return {
    items: items.slice(normalizedOffset, normalizedOffset + normalizedLimit),
    page: {
      total: items.length,
      limit: normalizedLimit,
      offset: normalizedOffset
    }
  };
}

export class EducationPlatformService extends FoundationService {
  constructor(options = {}) {
    super(options);
    this.gradingSystems = new Map();
    this.grades = new Map();
    this.attendance = new Map();
    this.scheduleEntries = new Map();
    this.assignments = new Map();
    this.assignmentSubmissions = new Map();
    this.reportCards = new Map();
    this.fees = new Map();
    this.invoices = new Map();
    this.payments = new Map();
    this.notifications = new Map();
    this.threads = new Map();
    this.messages = new Map();
    this.disciplineRecords = new Map();
    this.calendarEvents = new Map();
    this.virtualSchools = new Map();
    this.paidTrainings = new Map();
    this.certificates = new Map();
    this.localizationProfiles = new Map();
    this.platformSubscriptions = new Map();
    this.parentalConsents = new Map();
    this.campuses = new Map();
    this.operatingAuthorizations = new Map();
    this.accreditations = new Map();
    this.institutionVerifications = new Map();
    this.guardianProfiles = new Map();
    this.professionalProfiles = new Map();
    this.guardianLearnerRelations = new Map();
    this.professionalAssignments = new Map();
    this.academicPeriods = new Map();
    this.academicLevels = new Map();
    this.subjects = new Map();
    this.courses = new Map();
    this.learnerLifecycleEvents = new Map();
    this.contextualPermissionRules = new Map();
    this.documentTemplates = new Map();
    this.documentShares = new Map();
    this.consents = new Map();
    this.collaborationRequests = new Map();
    this.transfers = new Map();
    for (const collection of Object.values(PLATFORM_RESOURCE_COLLECTIONS)) {
      this[collection] = new Map();
    }
    this.externalAdapters = options.externalAdapters ?? {};
    this.seedStandardReferences();
  }

  seedStandardReferences() {
    for (const input of STANDARD_REFERENCES) {
      const entry = new ReferenceEntry({
        id: `standard:${input.catalog}:${input.code}`,
        ...input,
        organizationId: null,
        standard: true
      });
      if (!this.referenceEntries.has(entry.id)) this.referenceEntries.set(entry.id, entry);
    }
    return this.referenceEntries;
  }

  createPlatformRecord(resource, input, actorId = null) {
    const collectionName = PLATFORM_RESOURCE_COLLECTIONS[resource];
    if (!collectionName) throw new ValidationError(`Unsupported platform resource: ${resource}`);
    this.assertOrganizationContext(input.organizationId);
    for (const field of REQUIRED_FIELDS[resource] ?? []) {
      if (input[field] === undefined || input[field] === null || input[field] === '') {
        throw new ValidationError(`${field} is required.`);
      }
      if (input.code && Array.from(this[collectionName].values()).some((item) =>
        item.organizationId === input.organizationId && item.code === input.code && item.status !== 'archived'
      )) {
        throw new ValidationError(`code must be unique within ${resource} for the organization.`);
      }
      if (['lmsModules', 'lmsLessons'].includes(resource) && (!Number.isInteger(Number(input.position)) || Number(input.position) < 1)) {
        throw new ValidationError('position must be a positive integer.');
      }
      if (resource === 'lmsProgress' && (!Number.isFinite(Number(input.percent)) || Number(input.percent) < 0 || Number(input.percent) > 100)) {
        throw new ValidationError('percent must be between 0 and 100.');
      }
      if (resource === 'lmsQuizzes' && (!Number.isFinite(Number(input.passingScore)) || Number(input.passingScore) < 0 || Number(input.passingScore) > 100)) {
        throw new ValidationError('passingScore must be between 0 and 100.');
      }
      if (resource === 'meetings') {
        try {
          const url = new URL(input.externalUrl);
          if (!['https:', 'http:'].includes(url.protocol)) throw new Error('protocol');
          new Intl.DateTimeFormat('en', { timeZone: input.timezone });
        } catch {
          throw new ValidationError('externalUrl and timezone must be valid.');
        }
        if (Number.isNaN(Date.parse(input.startsAt))) throw new ValidationError('startsAt must be a valid date.');
      }
    }
    this.validatePlatformReferences(resource, input);
    let record;
    if (resource === 'meetingProviders') record = new ExternalProvider(input);
    else if (resource === 'dataQualityRules') record = new DataQualityRule(input);
    else if (resource === 'emisProfiles') record = new EmisProfile(input);
    else if (resource === 'referenceEntries') record = new ReferenceEntry({ ...input, standard: false });
    else record = new PlatformRecord(input);

    if (resource === 'lmsProgress') {
      record.percent = Number(input.percent);
      record.completedAt = record.percent === 100 ? (input.completedAt ?? new Date().toISOString()) : null;
    }
    if (resource === 'lmsEnrollments') record.enrollmentStatus = input.enrollmentStatus ?? 'active';
    if (resource === 'meetings') record.externalState = input.externalState ?? 'prepared';
    if (resource === 'emisExchanges') {
      record.exchangeState = 'prepared';
      record.attempts = [];
      record.preparedPayload = record.payload
        ? this.applyEmisMappings(record.profileId, record.payload, record.direction)
        : null;
      record.validationErrors = this.validateEmisPayload(record);
    }

    this[collectionName].set(record.id, record);
    this.recordEvent(`${resource}.created`, record, actorId);
    return record;
  }

  applyEmisMappings(profileId, payload, direction) {
    const mappings = Array.from(this.emisMappings.values()).filter((mapping) => mapping.profileId === profileId);
    const mapRecord = (record) => Object.fromEntries(mappings.map((mapping) => {
      const source = direction === 'export' ? mapping.sourceField : mapping.targetField;
      const target = direction === 'export' ? mapping.targetField : mapping.sourceField;
      const rawValue = record?.[source];
      const mappedValue = mapping.valueMapping?.[rawValue] ?? rawValue;
      return [target, mappedValue];
    }));
    if (Array.isArray(payload)) return payload.map(mapRecord);
    if (Array.isArray(payload?.items)) return { ...payload, items: payload.items.map(mapRecord) };
    return mapRecord(payload);
  }

  validatePlatformReferences(resource, input) {
    const links = {
      lmsPrograms: [['lmsCatalogs', input.catalogId, 'catalog'], ['programs', input.academicProgramId, 'academic program']],
      lmsCourses: [['lmsPrograms', input.programId, 'LMS program'], ['courses', input.academicCourseId, 'academic course']],
      lmsModules: [['lmsCourses', input.courseId, 'LMS course']],
      lmsLessons: [['lmsModules', input.moduleId, 'module']],
      lmsResources: [['lmsLessons', input.lessonId, 'lesson']],
      lmsParticipants: [['people', input.personId, 'person']],
      lmsEnrollments: [['lmsParticipants', input.participantId, 'participant'], ['lmsPrograms', input.programId, 'LMS program']],
      lmsProgress: [['lmsEnrollments', input.enrollmentId, 'LMS enrollment'], ['lmsLessons', input.lessonId, 'lesson']],
      lmsQuizzes: [['lmsCourses', input.courseId, 'LMS course']],
      lmsQuestions: [['lmsQuizzes', input.quizId, 'quiz']],
      lmsAssessments: [['lmsCourses', input.courseId, 'LMS course']],
      lmsPayments: [['lmsEnrollments', input.enrollmentId, 'LMS enrollment'], ['invoices', input.invoiceId, 'invoice']],
      lmsCertificates: [['lmsEnrollments', input.enrollmentId, 'LMS enrollment'], ['credentials', input.credentialId, 'credential']],
      meetings: [['meetingProviders', input.providerId, 'meeting provider']],
      meetingParticipants: [['meetings', input.meetingId, 'meeting'], ['people', input.personId, 'person']],
      meetingAttendance: [['meetings', input.meetingId, 'meeting'], ['people', input.personId, 'person']],
      emisMappings: [['emisProfiles', input.profileId, 'EMIS profile']],
      emisNationalReferences: [['emisProfiles', input.profileId, 'EMIS profile']],
      emisExchanges: [['emisProfiles', input.profileId, 'EMIS profile']]
    };
    for (const [collectionName, id, label] of links[resource] ?? []) {
      this.assertTenantRecord(this[collectionName], id, input.organizationId, label);
    }
    if (resource === 'lmsCourses') {
      const lmsProgram = this.lmsPrograms.get(input.programId);
      const academicCourse = this.courses.get(input.academicCourseId);
      if (academicCourse.programId && academicCourse.programId !== lmsProgram.academicProgramId) {
        throw new ValidationError('Academic course must belong to the LMS program academic program.');
      }
    }
    if (resource === 'lmsProgress') {
      const enrollment = this.lmsEnrollments.get(input.enrollmentId);
      const lesson = this.lmsLessons.get(input.lessonId);
      const course = this.lmsCourses.get(this.lmsModules.get(lesson.moduleId)?.courseId);
      if (course?.programId !== enrollment.programId) {
        throw new ValidationError('Lesson must belong to the enrollment LMS program.');
      }
    }
    if (resource === 'lmsAssessments' && input.gradingSystemId) {
      this.assertTenantRecord(this.gradingSystems, input.gradingSystemId, input.organizationId, 'grading system');
    }
    if (resource === 'lmsPayments' && input.paymentId) {
      const payment = this.assertTenantRecord(this.payments, input.paymentId, input.organizationId, 'payment');
      if (payment.invoiceId !== input.invoiceId) throw new ValidationError('Payment must belong to the linked invoice.');
    }
    if (resource === 'lmsCertificates' && input.certificateId) {
      this.assertTenantRecord(this.certificates, input.certificateId, input.organizationId, 'certificate');
    }
    if (resource === 'lmsCertificates') {
      const enrollment = this.lmsEnrollments.get(input.enrollmentId);
      const participant = this.lmsParticipants.get(enrollment.participantId);
      const credential = this.credentials.get(input.credentialId);
      if (credential.personId !== participant.personId) {
        throw new ValidationError('Credential holder must be the enrolled LMS participant.');
      }
    }
  }

  async submitLmsQuizAttempt(input, actorId = null) {
    const enrollment = this.assertTenantRecord(this.lmsEnrollments, input.enrollmentId, input.organizationId, 'LMS enrollment');
    const quiz = this.assertTenantRecord(this.lmsQuizzes, input.quizId, input.organizationId, 'quiz');
    const quizCourse = this.lmsCourses.get(quiz.courseId);
    if (quizCourse?.programId !== enrollment.programId) {
      throw new ValidationError('Quiz must belong to the enrollment LMS program.');
    }
    const questions = Array.from(this.lmsQuestions.values()).filter((item) => item.quizId === quiz.id);
    if (questions.length === 0) throw new ValidationError('Quiz has no questions.');
    const answers = input.answers ?? {};
    const correct = questions.filter((question) => {
      const answer = Array.isArray(answers)
        ? answers.find((item) => item.questionId === question.id)?.answer
        : answers[question.id];
      return JSON.stringify(answer) === JSON.stringify(question.correctAnswer);
    }).length;
    const score = Math.round((correct / questions.length) * 10000) / 100;
    return await this.createPlatformRecord('lmsAttempts', {
      ...input,
      score,
      passed: score >= Number(quiz.passingScore),
      submittedAt: new Date().toISOString()
    }, actorId);
  }

  getLmsEnrollmentProgress(enrollmentId, organizationId) {
    const enrollment = this.assertTenantRecord(this.lmsEnrollments, enrollmentId, organizationId, 'LMS enrollment');
    const programCourseIds = new Set(Array.from(this.lmsCourses.values())
      .filter((course) => course.programId === enrollment.programId)
      .map((course) => course.id));
    const moduleIds = new Set(Array.from(this.lmsModules.values())
      .filter((module) => programCourseIds.has(module.courseId))
      .map((module) => module.id));
    const lessons = Array.from(this.lmsLessons.values()).filter((lesson) => moduleIds.has(lesson.moduleId));
    const progress = Array.from(this.lmsProgress.values()).filter((item) => item.enrollmentId === enrollmentId);
    const completedLessonIds = new Set(progress.filter((item) => item.percent === 100).map((item) => item.lessonId));
    const percent = lessons.length === 0 ? 0 : Math.round((completedLessonIds.size / lessons.length) * 10000) / 100;
    return {
      enrollmentId,
      completedLessons: completedLessonIds.size,
      totalLessons: lessons.length,
      percent,
      completed: lessons.length > 0 && completedLessonIds.size === lessons.length
    };
  }

  getMeetingJoinDetails(meetingId, personId, organizationId) {
    const meeting = this.assertTenantRecord(this.meetings, meetingId, organizationId, 'meeting');
    const participant = Array.from(this.meetingParticipants.values()).find((item) =>
      item.meetingId === meetingId && item.personId === personId && item.organizationId === organizationId
    );
    if (!participant || participant.canJoin === false) throw new ValidationError('Participant is not allowed to join this meeting.');
    return {
      meetingId,
      externalMeetingId: meeting.externalMeetingId,
      externalUrl: meeting.externalUrl,
      role: participant.role,
      permissions: participant.permissions ?? []
    };
  }

  async importMeetingAttendance(meetingId, actorId = null) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) throw new ValidationError(`Unknown meeting: ${meetingId}`);
    const provider = this.meetingProviders.get(meeting.providerId);
    const adapter = provider?.adapterKey ? this.externalAdapters.meetings?.[provider.adapterKey] : null;
    if (!adapter?.importAttendance) {
      meeting.attendanceState = 'pending_external';
      meeting.touch();
      this.recordEvent('meeting.attendance.pending-external', meeting, actorId);
      return { meetingId, state: 'pending_external', imported: 0 };
    }
    const rows = await adapter.importAttendance({ provider, meeting });
    let imported = 0;
    for (const row of rows ?? []) {
      await this.createPlatformRecord('meetingAttendance', {
        ...row,
        organizationId: meeting.organizationId,
        meetingId
      }, actorId);
      imported += 1;
    }
    meeting.attendanceState = 'imported';
    meeting.touch();
    return { meetingId, state: 'imported', imported };
  }

  evaluateDataQualityRule(rule, record, records) {
    const value = record[rule.field];
    switch (rule.operator) {
      case 'required': return value !== undefined && value !== null && value !== '';
      case 'unique': return records.filter((candidate) => candidate[rule.field] === value).length <= 1;
      case 'iso-country': return typeof value === 'string' && /^[A-Z]{2}$/.test(value);
      case 'pattern': return new RegExp(rule.parameters?.pattern ?? '.*', 'u').test(String(value ?? ''));
      case 'reference': return Boolean(this[PLATFORM_RESOURCE_COLLECTIONS[rule.parameters?.resource] ?? rule.parameters?.resource]?.has(value));
      case 'not-future': return !value || Date.parse(value) <= Date.now();
      case 'equals-field': return value === record[rule.parameters?.otherField];
      default: throw new ValidationError(`Unsupported data quality operator: ${rule.operator}`);
    }
  }

  async runDataQuality(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const rules = Array.from(this.dataQualityRules.values()).filter((rule) =>
      rule.organizationId === input.organizationId
      && rule.status !== 'archived'
      && (!input.countryCode || !rule.countryCode || rule.countryCode === input.countryCode)
      && (!input.targetResource || rule.targetResource === input.targetResource)
    );
    const run = await this.createPlatformRecord('dataQualityRuns', {
      organizationId: input.organizationId,
      countryCode: input.countryCode ?? null,
      targetResource: input.targetResource ?? null,
      runState: 'running',
      startedAt: new Date().toISOString()
    }, actorId);
    let checked = 0;
    let failedWeight = 0;
    let totalWeight = 0;
    for (const rule of rules) {
      const collection = this[PLATFORM_RESOURCE_COLLECTIONS[rule.targetResource] ?? rule.targetResource];
      if (!collection?.values) throw new ValidationError(`Unsupported data quality target: ${rule.targetResource}`);
      const records = Array.from(collection.values()).filter((record) =>
        record.organizationId === input.organizationId && record.status !== 'archived'
      );
      for (const record of records) {
        checked += 1;
        totalWeight += rule.weight;
        if (!this.evaluateDataQualityRule(rule, record, records)) {
          failedWeight += rule.weight;
          await this.createPlatformRecord('dataQualityIssues', {
            organizationId: input.organizationId,
            runId: run.id,
            ruleId: rule.id,
            targetResource: rule.targetResource,
            targetId: record.id,
            field: rule.field,
            dimension: rule.dimension,
            issueState: 'open'
          }, actorId);
        }
      }
    }
    run.checked = checked;
    run.score = totalWeight === 0 ? 100 : Math.round(((totalWeight - failedWeight) / totalWeight) * 10000) / 100;
    run.runState = 'completed';
    run.completedAt = new Date().toISOString();
    run.touch();
    return run;
  }

  transitionDataQualityIssue(issueId, transition, input = {}, actorId = null) {
    const issue = this.dataQualityIssues.get(issueId);
    if (!issue) throw new ValidationError(`Unknown data quality issue: ${issueId}`);
    if (transition === 'correct') {
      if (!input.correction || typeof input.correction !== 'object' || Array.isArray(input.correction) || Object.keys(input.correction).length === 0) {
        throw new ValidationError('correction must be a non-empty object.');
      }
      issue.issueState = 'corrected';
      issue.correction = input.correction ?? null;
      issue.correctedAt = new Date().toISOString();
    } else if (transition === 'validate') {
      if (issue.issueState !== 'corrected') throw new ValidationError('Issue must be corrected before validation.');
      const rule = this.dataQualityRules.get(issue.ruleId);
      const collection = this[PLATFORM_RESOURCE_COLLECTIONS[issue.targetResource] ?? issue.targetResource];
      const target = collection?.get(issue.targetId);
      const records = collection
        ? Array.from(collection.values()).filter((record) => record.organizationId === issue.organizationId && record.status !== 'archived')
        : [];
      if (!rule || !target || !this.evaluateDataQualityRule(rule, target, records)) {
        throw new ValidationError('The corrected record still fails its data quality rule.');
      }
      issue.issueState = 'validated';
      issue.validatedAt = new Date().toISOString();
    } else {
      throw new ValidationError(`Unsupported issue transition: ${transition}`);
    }
    issue.touch();
    this.recordEvent(`data-quality.issue.${transition}`, issue, actorId);
    return issue;
  }

  async prevalidateExport(input, actorId = null) {
    const run = await this.runDataQuality(input, actorId);
    const openIssues = Array.from(this.dataQualityIssues.values()).filter((issue) =>
      issue.runId === run.id && issue.issueState !== 'validated'
    );
    return { state: openIssues.length === 0 ? 'validated' : 'blocked', score: run.score, runId: run.id, issueCount: openIssues.length };
  }

  validateEmisPayload(exchange) {
    const errors = [];
    if (!exchange.fileReference && (exchange.payload === null || typeof exchange.payload !== 'object')) {
      errors.push('payload must be structured or fileReference must be provided.');
    }
    if (!['import', 'export'].includes(exchange.direction)) errors.push('direction must be import or export.');
    return errors;
  }

  correctEmisExchange(exchangeId, input, actorId = null) {
    const exchange = this.emisExchanges.get(exchangeId);
    if (!exchange) throw new ValidationError(`Unknown EMIS exchange: ${exchangeId}`);
    if (!['validation_failed', 'transport_error', 'rejected', 'pending_external', 'prepared'].includes(exchange.exchangeState)) {
      throw new ValidationError(`Exchange in state ${exchange.exchangeState} cannot be corrected.`);
    }
    if (input.payload !== undefined) exchange.payload = input.payload;
    if (input.fileReference !== undefined) exchange.fileReference = input.fileReference;
    exchange.preparedPayload = exchange.payload
      ? this.applyEmisMappings(exchange.profileId, exchange.payload, exchange.direction)
      : null;
    exchange.validationErrors = this.validateEmisPayload(exchange);
    exchange.exchangeState = 'prepared';
    exchange.correctedAt = new Date().toISOString();
    exchange.touch();
    this.recordEvent('emis.exchange.corrected', exchange, actorId);
    return exchange;
  }

  async transmitEmisExchange(exchangeId, actorId = null, { retransmission = false } = {}) {
    const exchange = this.emisExchanges.get(exchangeId);
    if (!exchange) throw new ValidationError(`Unknown EMIS exchange: ${exchangeId}`);
    const allowedStates = retransmission
      ? ['transport_error', 'rejected', 'pending_external']
      : ['prepared', 'validation_failed'];
    if (!allowedStates.includes(exchange.exchangeState)) {
      throw new ValidationError(`Exchange in state ${exchange.exchangeState} cannot be ${retransmission ? 'retransmitted' : 'transmitted'}.`);
    }
    const profile = this.emisProfiles.get(exchange.profileId);
    const adapter = profile?.adapterKey ? this.externalAdapters.emis?.[profile.adapterKey] : null;
    const attemptedAt = new Date().toISOString();
    if (exchange.validationErrors.length > 0) {
      exchange.exchangeState = 'validation_failed';
      exchange.attempts.push({ attemptedAt, state: 'validation_failed', errors: exchange.validationErrors });
    } else if (!adapter?.transmit) {
      exchange.exchangeState = 'pending_external';
      exchange.attempts.push({ attemptedAt, state: 'pending_external', error: 'No external transport adapter configured.' });
    } else {
      try {
        const result = await adapter.transmit({ profile, exchange });
        exchange.exchangeState = 'sent';
        exchange.externalReference = result?.externalReference ?? null;
        exchange.attempts.push({ attemptedAt, state: 'sent', externalReference: exchange.externalReference });
      } catch (error) {
        exchange.exchangeState = 'transport_error';
        exchange.attempts.push({ attemptedAt, state: 'transport_error', error: error.message });
      }
    }
    exchange.touch();
    this.recordEvent(`emis.exchange.${exchange.exchangeState}`, exchange, actorId);
    return exchange;
  }

  acknowledgeEmisExchange(exchangeId, input, actorId = null) {
    const exchange = this.emisExchanges.get(exchangeId);
    if (!exchange) throw new ValidationError(`Unknown EMIS exchange: ${exchangeId}`);
    if (exchange.exchangeState !== 'sent') throw new ValidationError('Only a sent exchange can be acknowledged.');
    exchange.exchangeState = input.accepted === false ? 'rejected' : 'acknowledged';
    exchange.acknowledgement = input;
    exchange.touch();
    this.recordEvent(`emis.exchange.${exchange.exchangeState}`, exchange, actorId);
    return exchange;
  }

  listReferenceCatalog(catalog, { organizationId = null, countryCode = null, language = 'fr' } = {}) {
    const items = Array.from(this.referenceEntries.values())
      .filter((entry) => entry.catalog === catalog)
      .filter((entry) => entry.standard || entry.organizationId === organizationId)
      .filter((entry) => !countryCode || !entry.countryCode || entry.countryCode === countryCode)
      .map((entry) => ({ ...entry, label: entry.labels[language] ?? entry.labels.en ?? Object.values(entry.labels)[0] }));
    return paginate(items, { limit: 200, offset: 0 });
  }

  formatLocalizedValue(input) {
    const profile = Array.from(this.userLocalizationProfiles.values()).find((item) =>
      item.organizationId === input.organizationId && item.userId === input.userId
    ) ?? this.localizationProfiles.get(input.organizationId);
    if (!profile) throw new ValidationError('Localization profile is required.');
    const locale = input.locale ?? profile.language;
    if (input.type === 'date') {
      return { formatted: new Intl.DateTimeFormat(locale, {
        timeZone: input.timezone ?? profile.timezone,
        dateStyle: input.dateStyle ?? 'medium',
        calendar: input.calendar ?? profile.calendar ?? 'gregory'
      }).format(new Date(input.value)) };
    }
    if (input.type === 'currency') {
      return { formatted: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: input.currency ?? profile.currency
      }).format(Number(input.value)) };
    }
    return { formatted: new Intl.NumberFormat(locale).format(Number(input.value)) };
  }

  assertOrganizationContext(organizationId) {
    this.assertExists(this.organizations, organizationId, 'organization');
  }

  assertTenantRecord(collection, id, organizationId, label) {
    this.assertExists(collection, id, label);
    if (collection.get(id).organizationId !== organizationId) {
      throw new ValidationError(`${label} must belong to the same organization.`);
    }
    return collection.get(id);
  }

  createCampus(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const campus = new Campus(input);
    this.campuses.set(campus.id, campus);
    this.recordEvent('campus.created', campus, actorId);
    return campus;
  }

  createOperatingAuthorization(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const authorization = new OperatingAuthorization(input);
    this.operatingAuthorizations.set(authorization.id, authorization);
    this.recordEvent('operating-authorization.created', authorization, actorId);
    return authorization;
  }

  createAccreditation(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    if (input.targetType === 'institution' && input.targetId !== input.organizationId) {
      throw new ValidationError('Institution accreditation targetId must equal organizationId.');
    }
    if (input.targetType === 'site') this.assertTenantRecord(this.campuses, input.targetId, input.organizationId, 'campus');
    if (input.targetType === 'program') this.assertTenantRecord(this.programs, input.targetId, input.organizationId, 'program');
    if (input.targetType === 'level') this.assertTenantRecord(this.academicLevels, input.targetId, input.organizationId, 'academic level');
    const accreditation = new Accreditation(input);
    this.accreditations.set(accreditation.id, accreditation);
    this.recordEvent('accreditation.created', accreditation, actorId);
    return accreditation;
  }

  createInstitutionVerification(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    if (Array.from(this.institutionVerifications.values()).some((item) => item.publicCode === input.publicCode)) {
      throw new ValidationError('publicCode must be unique.');
    }
    const verification = new InstitutionVerification(input);
    this.institutionVerifications.set(verification.id, verification);
    this.recordEvent('institution-verification.created', verification, actorId);
    return verification;
  }

  createGuardianProfile(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.people, input.personId, 'person');
    const person = this.people.get(input.personId);
    if (person.primaryOrganizationId && person.primaryOrganizationId !== input.organizationId) {
      throw new ValidationError('Guardian profile person must belong to the same organization.');
    }
    const profile = new GuardianProfile(input);
    this.guardianProfiles.set(profile.id, profile);
    this.recordEvent('guardian-profile.created', profile, actorId);
    return profile;
  }

  createProfessionalProfile(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.people, input.personId, 'person');
    const person = this.people.get(input.personId);
    if (person.primaryOrganizationId && person.primaryOrganizationId !== input.organizationId) {
      throw new ValidationError('Professional profile person must belong to the same organization.');
    }
    const assignmentOrganizationIds = [...new Set([
      input.organizationId,
      ...(input.assignmentOrganizationIds ?? [])
    ])];
    for (const organizationId of assignmentOrganizationIds) {
      this.assertOrganizationContext(organizationId);
    }
    const profile = new ProfessionalProfile({ ...input, assignmentOrganizationIds });
    this.professionalProfiles.set(profile.id, profile);
    this.recordEvent('professional-profile.created', profile, actorId);
    return profile;
  }

  createGuardianLearnerRelation(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertTenantRecord(this.guardianProfiles, input.guardianProfileId, input.organizationId, 'guardian profile');
    this.assertTenantRecord(this.learners, input.learnerId, input.organizationId, 'learner');
    const relation = new GuardianLearnerRelation(input);
    this.guardianLearnerRelations.set(relation.id, relation);
    this.recordEvent('guardian-learner-relation.created', relation, actorId);
    return relation;
  }

  createProfessionalAssignment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.professionalProfiles, input.professionalProfileId, 'professional profile');
    const profile = this.professionalProfiles.get(input.professionalProfileId);
    if (!profile.assignmentOrganizationIds.includes(input.organizationId)) {
      throw new ValidationError('Professional profile is not authorized for assignments in this organization.');
    }
    if (input.campusId) this.assertTenantRecord(this.campuses, input.campusId, input.organizationId, 'campus');
    const assignment = new ProfessionalAssignment(input);
    this.professionalAssignments.set(assignment.id, assignment);
    this.recordEvent('professional-assignment.created', assignment, actorId);
    return assignment;
  }

  createAcademicPeriod(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertTenantRecord(this.academicYears, input.academicYearId, input.organizationId, 'academic year');
    const period = new AcademicPeriod(input);
    this.academicPeriods.set(period.id, period);
    this.recordEvent('academic-period.created', period, actorId);
    return period;
  }

  createAcademicLevel(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const level = new AcademicLevel(input);
    this.academicLevels.set(level.id, level);
    this.recordEvent('academic-level.created', level, actorId);
    return level;
  }

  createSubject(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const subject = new Subject(input);
    this.subjects.set(subject.id, subject);
    this.recordEvent('subject.created', subject, actorId);
    return subject;
  }

  createCourse(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertTenantRecord(this.subjects, input.subjectId, input.organizationId, 'subject');
    this.assertTenantRecord(this.academicPeriods, input.academicPeriodId, input.organizationId, 'academic period');
    if (input.classId) this.assertTenantRecord(this.classes, input.classId, input.organizationId, 'class');
    if (input.programId) this.assertTenantRecord(this.programs, input.programId, input.organizationId, 'program');
    for (const assignmentId of input.teacherAssignmentIds ?? []) {
      this.assertTenantRecord(this.professionalAssignments, assignmentId, input.organizationId, 'professional assignment');
    }
    const course = new Course(input);
    this.courses.set(course.id, course);
    this.recordEvent('course.created', course, actorId);
    return course;
  }

  recordLearnerLifecycleEvent(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const learner = this.assertTenantRecord(this.learners, input.learnerId, input.organizationId, 'learner');
    const event = new LearnerLifecycleEvent(input);
    this.learnerLifecycleEvents.set(event.id, event);
    learner.status = event.eventType;
    learner.touch(new Date(event.occurredAt));
    this.recordEvent(`learner-lifecycle.${event.eventType}`, event, actorId, {
      previousContext: event.previousContext,
      newContext: event.newContext,
      authority: event.authority
    });
    return event;
  }

  createContextualPermissionRule(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const rule = new ContextualPermissionRule(input);
    this.contextualPermissionRules.set(rule.id, rule);
    this.recordEvent('contextual-permission-rule.created', rule, actorId);
    return rule;
  }

  createDocumentTemplate(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const template = new DocumentTemplate(input);
    this.documentTemplates.set(template.id, template);
    this.recordEvent('document-template.created', template, actorId);
    return template;
  }

  recordConsent(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.people, input.subjectPersonId, 'subject person');
    this.assertExists(this.people, input.authorityPersonId, 'authority person');
    this.assertOrganizationContext(input.recipientOrganizationId);
    for (const personId of [input.subjectPersonId, input.authorityPersonId]) {
      const person = this.people.get(personId);
      if (person.primaryOrganizationId && person.primaryOrganizationId !== input.organizationId) {
        throw new ValidationError('Consent subjects and authorities must belong to the source organization.');
      }
    }
    if (Date.parse(input.expiresAt) <= Date.now()) {
      throw new ValidationError('Consent expiresAt must be in the future.');
    }
    const consent = new ConsentRecord(input);
    this.consents.set(consent.id, consent);
    this.recordEvent('consent.granted', consent, actorId, {
      purpose: consent.purpose,
      dataScope: consent.dataScope,
      legalBasis: consent.legalBasis
    });
    return consent;
  }

  createDocumentShare(input, actorId = null) {
    this.assertTenantRecord(this.documents, input.documentId, input.organizationId, 'document');
    const publicFields = new Set([
      'id', 'type', 'title', 'documentNumber', 'issuedAt', 'expiresAt', 'fileHash', 'hashAlgorithm'
    ]);
    if (!Array.isArray(input.dataScope) || input.dataScope.length === 0
      || !input.dataScope.every((field) => publicFields.has(field))) {
      throw new ValidationError('dataScope must contain only approved public document fields.');
    }
    if (Date.parse(input.expiresAt) <= Date.now()) {
      throw new ValidationError('Share expiresAt must be in the future.');
    }
    if (input.consentId) {
      const consent = this.assertTenantRecord(this.consents, input.consentId, input.organizationId, 'consent');
      if (consent.status !== 'active' || consent.withdrawnAt || Date.parse(consent.expiresAt) <= Date.now()) {
        throw new ValidationError('Consent is not active.');
      }
      if (!input.dataScope.every((field) => consent.dataScope.includes(field))) {
        throw new ValidationError('Share dataScope exceeds consent.');
      }
    }
    const share = new DocumentShare(input);
    this.documentShares.set(share.id, share);
    this.recordEvent('document-share.created', share, actorId, {
      purpose: share.purpose,
      dataScope: share.dataScope
    });
    return share;
  }

  createCollaborationRequest(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertOrganizationContext(input.destinationOrganizationId);
    if (input.sourceOrganizationId && input.sourceOrganizationId !== input.organizationId) {
      throw new ValidationError('sourceOrganizationId must match organizationId.');
    }
    if (Date.parse(input.expiresAt) <= Date.now()) {
      throw new ValidationError('Collaboration expiresAt must be in the future.');
    }
    const collaboration = new CollaborationRequest(input);
    this.collaborationRequests.set(collaboration.id, collaboration);
    this.recordEvent('collaboration.requested', collaboration, actorId, {
      purpose: collaboration.purpose,
      dataScope: collaboration.dataScope
    });
    return collaboration;
  }

  createTransfer(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertOrganizationContext(input.destinationOrganizationId);
    if (input.sourceOrganizationId && input.sourceOrganizationId !== input.organizationId) {
      throw new ValidationError('sourceOrganizationId must match organizationId.');
    }
    this.assertTenantRecord(this.learners, input.learnerId, input.organizationId, 'learner');
    if (input.authorizationBasis === 'consent') {
      const consent = this.assertTenantRecord(this.consents, input.consentId, input.organizationId, 'consent');
      if (consent.status !== 'active' || consent.withdrawnAt || Date.parse(consent.expiresAt) <= Date.now()) {
        throw new ValidationError('An active consent is required for this transfer.');
      }
      if (consent.recipientOrganizationId !== input.destinationOrganizationId) {
        throw new ValidationError('Consent recipient must match transfer destination.');
      }
      if (!input.requestedData.every((field) => consent.dataScope.includes(field))) {
        throw new ValidationError('Transfer requestedData exceeds consent.');
      }
      if (consent.subjectPersonId !== this.learners.get(input.learnerId).personId) {
        throw new ValidationError('Consent subject must match the transferred learner.');
      }
    }
    if (!input.encryption?.algorithm && !String(input.securePayloadReference).startsWith('vault://')) {
      throw new ValidationError('Transfer requires encryption metadata or a vault reference.');
    }
    const transfer = new TransferRecord(input);
    this.transfers.set(transfer.id, transfer);
    this.recordEvent('transfer.created', transfer, actorId, {
      authorizationBasis: transfer.authorizationBasis,
      requestedData: transfer.requestedData
    });
    return transfer;
  }

  configureGradingSystem(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const system = new GradingSystem(input);
    this.gradingSystems.set(system.id, system);
    this.recordEvent('grading.system.configured', system, actorId);
    return system;
  }

  recordGrade(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
    if (input.assignmentId) {
      this.assertExists(this.assignments, input.assignmentId, 'assignment');
    }

    const previous = Array.from(this.grades.values())
      .filter((entry) => entry.organizationId === input.organizationId
        && entry.learnerId === input.learnerId
        && entry.assignmentId === (input.assignmentId ?? null))
      .sort((a, b) => b.version - a.version)[0] ?? null;

    const grade = new GradeEntry({
      ...input,
      assignmentId: input.assignmentId ?? null,
      version: previous ? previous.version + 1 : 1
    });

    this.grades.set(grade.id, grade);
    this.recordEvent('grading.grade.recorded', grade, actorId, { version: grade.version });
    return grade;
  }

  calculateLearnerAverage({ organizationId, learnerId }) {
    const grades = Array.from(this.grades.values())
      .filter((entry) => entry.organizationId === organizationId && entry.learnerId === learnerId);
    const latestByAssessment = new Map();
    for (const grade of grades) {
      const assessmentKey = grade.assignmentId ?? '__manual__';
      const currentLatest = latestByAssessment.get(assessmentKey);
      if (!currentLatest || grade.version > currentLatest.version) {
        latestByAssessment.set(assessmentKey, grade);
      }
    }
    const effectiveGrades = Array.from(latestByAssessment.values());

    if (effectiveGrades.length === 0) {
      return { averageOn20: 0, weightedPoints: 0, totalCoefficients: 0 };
    }

    const weightedPoints = effectiveGrades.reduce((sum, item) => sum + item.weightedScore, 0);
    const totalCoefficients = effectiveGrades.reduce((sum, item) => sum + item.coefficient, 0);
    return {
      averageOn20: totalCoefficients === 0 ? 0 : Number((weightedPoints / totalCoefficients).toFixed(2)),
      weightedPoints: Number(weightedPoints.toFixed(2)),
      totalCoefficients
    };
  }

  listGrades({ organizationId, learnerId = null, limit, offset } = {}) {
    const grades = Array.from(this.grades.values()).filter((entry) => {
      if (organizationId && entry.organizationId !== organizationId) {
        return false;
      }

      if (learnerId && entry.learnerId !== learnerId) {
        return false;
      }

      return true;
    });

    return paginate(grades, { limit, offset });
  }

  recordAttendance(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
    this.assertExists(this.classes, input.classId, 'class');
    const record = new AttendanceRecord(input);
    this.attendance.set(record.id, record);
    this.recordEvent('attendance.recorded', record, actorId, { status: record.status });

    if (record.status === 'absent' || record.status === 'unexcused') {
      this.createNotification({
        organizationId: record.organizationId,
        eventType: 'attendance.absence',
        channel: 'internal',
        recipientId: record.learnerId,
        payload: { attendanceRecordId: record.id }
      }, actorId);
    }

    return record;
  }

  getAttendanceRate({ organizationId, learnerId }) {
    const records = Array.from(this.attendance.values())
      .filter((record) => record.organizationId === organizationId && record.learnerId === learnerId);
    if (records.length === 0) {
      return { total: 0, present: 0, rate: 0 };
    }

    const present = records.filter((record) => record.status !== 'absent' && record.status !== 'unexcused').length;
    return {
      total: records.length,
      present,
      rate: Number(((present / records.length) * 100).toFixed(2))
    };
  }

  createScheduleEntry(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.classes, input.classId, 'class');
    this.assertExists(this.people, input.teacherPersonId, 'person');
    const learningClass = this.classes.get(input.classId);
    const teacher = this.people.get(input.teacherPersonId);
    if (learningClass.organizationId !== input.organizationId) {
      throw new ValidationError('Schedule entry organizationId must match class.organizationId.');
    }
    if (teacher.primaryOrganizationId && teacher.primaryOrganizationId !== input.organizationId) {
      throw new ValidationError('Schedule entry teacher must belong to the same organization.');
    }
    const entry = new ScheduleEntry(input);
    this.scheduleEntries.set(entry.id, entry);
    this.recordEvent('scheduling.entry.created', entry, actorId);
    return entry;
  }

  createAssignment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.classes, input.classId, 'class');
    const learningClass = this.classes.get(input.classId);
    if (learningClass.organizationId !== input.organizationId) {
      throw new ValidationError('Assignment organizationId must match class.organizationId.');
    }
    const assignment = new Assignment(input);
    this.assignments.set(assignment.id, assignment);
    this.recordEvent('assignments.created', assignment, actorId);
    return assignment;
  }

  submitAssignment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.assignments, input.assignmentId, 'assignment');
    this.assertExists(this.learners, input.learnerId, 'learner');
    const assignment = this.assignments.get(input.assignmentId);
    const learner = this.learners.get(input.learnerId);
    if (assignment.organizationId !== input.organizationId) {
      throw new ValidationError('Submission organizationId must match assignment.organizationId.');
    }
    if (learner.organizationId !== input.organizationId) {
      throw new ValidationError('Submission organizationId must match learner.organizationId.');
    }
    const submission = new AssignmentSubmission(input);
    this.assignmentSubmissions.set(submission.id, submission);

    const due = Date.parse(assignment.dueAt);
    const submitted = Date.parse(submission.submittedAt);

    if (!Number.isNaN(due) && !Number.isNaN(submitted) && submitted > due) {
      this.recordEvent('assignments.submission.late', submission, actorId, { dueAt: assignment.dueAt });
    } else {
      this.recordEvent('assignments.submitted', submission, actorId);
    }

    return submission;
  }

  gradeSubmission(submissionId, input, actorId = null) {
    this.assertExists(this.assignmentSubmissions, submissionId, 'submission');
    const submission = this.assignmentSubmissions.get(submissionId);
    submission.score = Number(input.score);
    submission.maxScore = Number(input.maxScore ?? 20);
    submission.touch();
    this.recordEvent('assignments.submission.graded', submission, actorId);

    return this.recordGrade({
      organizationId: submission.organizationId,
      learnerId: submission.learnerId,
      assignmentId: submission.assignmentId,
      score: submission.score,
      maxScore: submission.maxScore,
      coefficient: Number(input.coefficient ?? 1)
    }, actorId);
  }

  generateReportCard(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
    const average = this.calculateLearnerAverage({ organizationId: input.organizationId, learnerId: input.learnerId });
    const attendance = this.getAttendanceRate({ organizationId: input.organizationId, learnerId: input.learnerId });
    const report = new ReportCard({
      ...input,
      average: average.averageOn20,
      absences: attendance.total - attendance.present
    });
    this.reportCards.set(report.id, report);
    this.recordEvent('reports.report-card.generated', report, actorId);
    return report;
  }

  configureFee(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const fee = new FeeConfiguration(input);
    this.fees.set(fee.id, fee);
    this.recordEvent('finance.fee.configured', fee, actorId);
    return fee;
  }

  createInvoice(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
    this.assertExists(this.fees, input.feeConfigurationId, 'fee configuration');
    const learner = this.learners.get(input.learnerId);
    const fee = this.fees.get(input.feeConfigurationId);
    if (learner.organizationId !== input.organizationId) {
      throw new ValidationError('Invoice organizationId must match learner.organizationId.');
    }
    if (fee.organizationId !== input.organizationId) {
      throw new ValidationError('Invoice organizationId must match fee.organizationId.');
    }
    const invoice = new Invoice(input);
    this.invoices.set(invoice.id, invoice);
    this.recordEvent('finance.invoice.created', invoice, actorId);
    return invoice;
  }

  recordPayment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.invoices, input.invoiceId, 'invoice');
    const invoice = this.invoices.get(input.invoiceId);
    if (invoice.organizationId !== input.organizationId) {
      throw new ValidationError('Payment organizationId must match invoice.organizationId.');
    }
    const payment = new Payment(input);
    if (invoice.currency !== payment.currency) {
      throw new ValidationError('Payment currency must match invoice currency.');
    }
    if (payment.amount > invoice.balance) {
      throw new ValidationError('Payment amount cannot exceed invoice balance.');
    }

    this.payments.set(payment.id, payment);
    invoice.balance = Number((invoice.balance - payment.amount).toFixed(2));
    invoice.touch();
    this.recordEvent('finance.payment.recorded', payment, actorId, { remainingBalance: invoice.balance });
    return payment;
  }

  createNotification(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const notification = new Notification(input);
    this.notifications.set(notification.id, notification);
    this.recordEvent('notifications.created', notification, actorId, { channel: notification.channel });
    return notification;
  }

  markNotificationSent(notificationId, actorId = null) {
    this.assertExists(this.notifications, notificationId, 'notification');
    const notification = this.notifications.get(notificationId);
    notification.markSent();
    this.recordEvent('notifications.sent', notification, actorId);
    return notification;
  }

  createDiscussionThread(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const thread = new DiscussionThread(input);
    this.threads.set(thread.id, thread);
    this.recordEvent('communications.thread.created', thread, actorId);
    return thread;
  }

  postThreadMessage(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.threads, input.threadId, 'thread');
    this.assertExists(this.people, input.authorPersonId, 'person');
    const thread = this.threads.get(input.threadId);
    if (thread.organizationId !== input.organizationId) {
      throw new ValidationError('Message organizationId must match thread.organizationId.');
    }
    const message = new ThreadMessage(input);
    this.messages.set(message.id, message);
    this.recordEvent('communications.message.posted', message, actorId);
    return message;
  }

  recordDiscipline(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
    const learner = this.learners.get(input.learnerId);
    if (learner.organizationId !== input.organizationId) {
      throw new ValidationError('Discipline organizationId must match learner.organizationId.');
    }
    const record = new DisciplineRecord(input);
    this.disciplineRecords.set(record.id, record);
    this.recordEvent('discipline.recorded', record, actorId);
    return record;
  }

  createCalendarEvent(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const event = new CalendarEvent(input);
    this.calendarEvents.set(event.id, event);
    this.recordEvent('calendar.event.created', event, actorId);
    return event;
  }

  createVirtualSchool(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const virtualSchool = new VirtualSchool(input);
    this.virtualSchools.set(virtualSchool.id, virtualSchool);
    this.recordEvent('virtual-school.created', virtualSchool, actorId);
    return virtualSchool;
  }

  createPaidTraining(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.virtualSchools, input.virtualSchoolId, 'virtual school');
    const virtualSchool = this.virtualSchools.get(input.virtualSchoolId);
    if (virtualSchool.organizationId !== input.organizationId) {
      throw new ValidationError('Training organizationId must match virtualSchool.organizationId.');
    }
    const training = new PaidTraining(input);
    this.paidTrainings.set(training.id, training);
    this.recordEvent('virtual-school.training.created', training, actorId);
    return training;
  }

  issueCertificate(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
    const learner = this.learners.get(input.learnerId);
    if (learner.organizationId !== input.organizationId) {
      throw new ValidationError('Certificate organizationId must match learner.organizationId.');
    }
    const certificate = new Certificate({
      ...input,
      verificationCode: input.verificationCode ?? createPermanentId()
    });
    this.certificates.set(certificate.id, certificate);
    this.recordEvent('certificates.issued', certificate, actorId);
    return certificate;
  }

  upsertLocalizationProfile(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const profile = new LocalizationProfile(input);
    this.localizationProfiles.set(profile.organizationId, profile);
    this.recordEvent('i18n.profile.updated', profile, actorId);
    return profile;
  }

  createPlatformSubscription(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    const subscription = new PlatformSubscription(input);
    this.platformSubscriptions.set(subscription.id, subscription);
    this.recordEvent('subscriptions.platform.created', subscription, actorId);
    return subscription;
  }

  recordParentalConsent({ organizationId, learnerId, parentPersonId, scope, grantedAt = new Date().toISOString() }, actorId = null) {
    this.assertOrganizationContext(organizationId);
    this.assertExists(this.learners, learnerId, 'learner');
    this.assertExists(this.people, parentPersonId, 'person');
    const learner = this.learners.get(learnerId);
    const parent = this.people.get(parentPersonId);
    if (learner.organizationId !== organizationId) {
      throw new ValidationError('Parental consent organizationId must match learner.organizationId.');
    }
    if (parent.primaryOrganizationId && parent.primaryOrganizationId !== organizationId) {
      throw new ValidationError('Parental consent parent must belong to the same organization.');
    }
    const id = `${organizationId}:${learnerId}:${parentPersonId}:${scope}`;
    const consent = {
      id,
      organizationId,
      learnerId,
      parentPersonId,
      scope,
      grantedAt
    };

    this.parentalConsents.set(id, consent);
    this.recordEvent('security.parental-consent.recorded', { id, organizationId, constructor: { name: 'ParentalConsent' } }, actorId, {
      learnerId,
      parentPersonId,
      scope
    });
    return consent;
  }

  getAuditTrail({ organizationId = null, limit, offset } = {}) {
    const events = this.events.filter((event) => !organizationId || event.organizationId === organizationId);
    return paginate(events, { limit, offset });
  }

  describePlatform() {
    const foundation = this.describeFoundation();
    return {
      ...foundation,
      scope: 'full-specification-foundation',
      phases: [
        ...FOUNDATION_PHASES,
        'grading',
        'attendance',
        'scheduling',
        'assignments',
        'communications',
        'finance',
        'reports',
        'discipline',
        'notifications',
        'calendar',
        'dashboards',
        'virtual-schools-and-trainings',
        'certificates',
        'i18n',
        'lms',
        'external-meetings',
        'data-quality',
        'emis',
        'reference-data',
        'subscriptions',
        'audit',
        'security',
        'rest-api',
        'integration-tests'
      ],
      invariants: [
        ...FOUNDATION_INVARIANTS,
        'all module writes are organization-scoped and auditable',
        'grading, documents and permissions remain version-aware',
        'child-related actions require explicit parental consent records'
        ,
        'external meeting and EMIS success requires an injected provider adapter',
        'reference and localization rules remain tenant and country configurable'
      ],
      modules: [
        ...foundation.modules,
        'grading',
        'attendance',
        'scheduling',
        'assignments',
        'reports',
        'finance',
        'notifications',
        'communications',
        'discipline',
        'calendar',
        'virtual-schools',
        'certificates',
        'subscriptions',
        'i18n'
        ,
        'lms',
        'meetings',
        'data-quality',
        'emis',
        'references'
      ],
      summary: {
        ...foundation.summary,
        gradingSystems: this.gradingSystems.size,
        grades: this.grades.size,
        attendance: this.attendance.size,
        scheduleEntries: this.scheduleEntries.size,
        assignments: this.assignments.size,
        submissions: this.assignmentSubmissions.size,
        reports: this.reportCards.size,
        fees: this.fees.size,
        invoices: this.invoices.size,
        payments: this.payments.size,
        notifications: this.notifications.size,
        threads: this.threads.size,
        messages: this.messages.size,
        disciplineRecords: this.disciplineRecords.size,
        calendarEvents: this.calendarEvents.size,
        virtualSchools: this.virtualSchools.size,
        paidTrainings: this.paidTrainings.size,
        certificates: this.certificates.size,
        subscriptions: this.platformSubscriptions.size,
        localizationProfiles: this.localizationProfiles.size,
        parentalConsents: this.parentalConsents.size,
        lmsCourses: this.lmsCourses.size,
        lmsEnrollments: this.lmsEnrollments.size,
        meetings: this.meetings.size,
        dataQualityIssues: this.dataQualityIssues.size,
        emisExchanges: this.emisExchanges.size,
        referenceEntries: this.referenceEntries.size
      }
    };
  }
}

export function createEducationPlatformService(options = {}) {
  return new EducationPlatformService(options);
}
