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
import { ValidationError, createPermanentId } from '../shared/entity.js';

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
  }

  assertOrganizationContext(organizationId) {
    this.assertExists(this.organizations, organizationId, 'organization');
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

    if (grades.length === 0) {
      return { averageOn20: 0, weightedPoints: 0, totalCoefficients: 0 };
    }

    const weightedPoints = grades.reduce((sum, item) => sum + item.weightedScore, 0);
    const totalCoefficients = grades.reduce((sum, item) => sum + item.coefficient, 0);
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

    const present = records.filter((record) => record.status === 'present').length;
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
    const entry = new ScheduleEntry(input);
    this.scheduleEntries.set(entry.id, entry);
    this.recordEvent('scheduling.entry.created', entry, actorId);
    return entry;
  }

  createAssignment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.classes, input.classId, 'class');
    const assignment = new Assignment(input);
    this.assignments.set(assignment.id, assignment);
    this.recordEvent('assignments.created', assignment, actorId);
    return assignment;
  }

  submitAssignment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.assignments, input.assignmentId, 'assignment');
    this.assertExists(this.learners, input.learnerId, 'learner');
    const submission = new AssignmentSubmission(input);
    this.assignmentSubmissions.set(submission.id, submission);

    const assignment = this.assignments.get(submission.assignmentId);
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
    const invoice = new Invoice(input);
    this.invoices.set(invoice.id, invoice);
    this.recordEvent('finance.invoice.created', invoice, actorId);
    return invoice;
  }

  recordPayment(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.invoices, input.invoiceId, 'invoice');
    const payment = new Payment(input);
    this.payments.set(payment.id, payment);

    const invoice = this.invoices.get(payment.invoiceId);
    if (invoice.currency !== payment.currency) {
      throw new ValidationError('Payment currency must match invoice currency.');
    }

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
    const message = new ThreadMessage(input);
    this.messages.set(message.id, message);
    this.recordEvent('communications.message.posted', message, actorId);
    return message;
  }

  recordDiscipline(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
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
    const training = new PaidTraining(input);
    this.paidTrainings.set(training.id, training);
    this.recordEvent('virtual-school.training.created', training, actorId);
    return training;
  }

  issueCertificate(input, actorId = null) {
    this.assertOrganizationContext(input.organizationId);
    this.assertExists(this.learners, input.learnerId, 'learner');
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
    const id = `${organizationId}:${learnerId}:${scope}`;
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
        parentalConsents: this.parentalConsents.size
      }
    };
  }
}

export function createEducationPlatformService(options = {}) {
  return new EducationPlatformService(options);
}
