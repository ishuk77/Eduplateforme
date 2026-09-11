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
