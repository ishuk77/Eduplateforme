import { createEducationPlatformService } from '../services/education-platform-service.js';
import { handleHttpError } from './middleware/error-handling.js';
import { createRouter } from './routes/_router.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerOrganizationRoutes } from './routes/organizations.js';
import { registerAcademicRoutes } from './routes/academics.js';
import { registerGradingRoutes } from './routes/grading.js';
import { registerAttendanceRoutes } from './routes/attendance.js';
import { registerSchedulingRoutes } from './routes/scheduling.js';
import { registerAssignmentRoutes } from './routes/assignments.js';
import { registerCommunicationRoutes } from './routes/communications.js';
import { registerFinanceRoutes } from './routes/finance.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerDisciplineRoutes } from './routes/discipline.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerVirtualSchoolRoutes } from './routes/virtual-schools.js';
import { registerCertificateRoutes } from './routes/certificates.js';
import { registerSubscriptionRoutes } from './routes/subscriptions.js';
import { registerI18nRoutes } from './routes/i18n.js';
import { registerSecurityRoutes } from './routes/security.js';
import { registerAuditRoutes } from './routes/audit.js';

function createOpenApiDescription() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Eduplateforme API',
      version: '1.0.0'
    },
    paths: {
      '/health': { get: { summary: 'Health check' } },
      '/meta/foundation': { get: { summary: 'Foundation and module metadata' } },
      '/meta/openapi': { get: { summary: 'OpenAPI summary' } },
      '/organizations': { post: { summary: 'Create organization' } },
      '/users': { post: { summary: 'Register person' } },
      '/accounts': { post: { summary: 'Open user account' } },
      '/academics/learners': { post: { summary: 'Create learner' } },
      '/academics/years': { post: { summary: 'Create academic year' } },
      '/academics/programs': { post: { summary: 'Create program' } },
      '/academics/classes': { post: { summary: 'Create class' } },
      '/academics/enrollments': { post: { summary: 'Create enrollment' } },
      '/grading/systems': { post: { summary: 'Configure grading system' } },
      '/grading/grades': { post: { summary: 'Record grade' }, get: { summary: 'List grades' } },
      '/grading/average': { get: { summary: 'Calculate learner average' } },
      '/attendance/records': { post: { summary: 'Record attendance' } },
      '/attendance/rate': { get: { summary: 'Get attendance rate' } },
      '/scheduling/entries': { post: { summary: 'Create schedule entry' } },
      '/assignments': { post: { summary: 'Create assignment' } },
      '/assignments/submissions': { post: { summary: 'Submit assignment' } },
      '/assignments/submissions/grade': { post: { summary: 'Grade submission' } },
      '/communications/threads': { post: { summary: 'Create thread' } },
      '/communications/messages': { post: { summary: 'Post message' } },
      '/finance/fees': { post: { summary: 'Configure fee' } },
      '/finance/invoices': { post: { summary: 'Create invoice' } },
      '/finance/payments': { post: { summary: 'Record payment' } },
      '/reports/cards': { post: { summary: 'Generate report card' } },
      '/discipline/records': { post: { summary: 'Record discipline event' } },
      '/notifications': { post: { summary: 'Create notification' } },
      '/notifications/sent': { post: { summary: 'Mark notification as sent' } },
      '/calendar/events': { post: { summary: 'Create calendar event' } },
      '/virtual-schools': { post: { summary: 'Create virtual school' } },
      '/virtual-schools/trainings': { post: { summary: 'Create paid training' } },
      '/certificates': { post: { summary: 'Issue certificate' } },
      '/subscriptions/platform': { post: { summary: 'Create platform subscription' } },
      '/i18n/profile': { post: { summary: 'Set localization profile' } },
      '/security/parental-consents': { post: { summary: 'Record parental consent' } },
      '/audit/events': { get: { summary: 'List audit events' } }
    }
  };
}

export function createApp({ foundation = createEducationPlatformService() } = {}) {
  const router = createRouter();
  const context = { service: foundation };

  registerAuthRoutes(router, context);
  registerUserRoutes(router, context);
  registerOrganizationRoutes(router, context);
  registerAcademicRoutes(router, context);
  registerGradingRoutes(router, context);
  registerAttendanceRoutes(router, context);
  registerSchedulingRoutes(router, context);
  registerAssignmentRoutes(router, context);
  registerCommunicationRoutes(router, context);
  registerFinanceRoutes(router, context);
  registerDocumentRoutes(router, context);
  registerReportRoutes(router, context);
  registerDisciplineRoutes(router, context);
  registerNotificationRoutes(router, context);
  registerCalendarRoutes(router, context);
  registerVirtualSchoolRoutes(router, context);
  registerCertificateRoutes(router, context);
  registerSubscriptionRoutes(router, context);
  registerI18nRoutes(router, context);
  registerSecurityRoutes(router, context);
  registerAuditRoutes(router, context);

  return async function app(request) {
    try {
      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return Response.json({ status: 'ok' });
      }

      if (request.method === 'GET' && url.pathname === '/meta/foundation') {
        return Response.json(foundation.describePlatform());
      }

      if (request.method === 'GET' && url.pathname === '/meta/invariants') {
        const description = foundation.describePlatform();
        return Response.json({ scope: description.scope, invariants: description.invariants });
      }

      if (request.method === 'GET' && url.pathname === '/meta/openapi') {
        return Response.json(createOpenApiDescription());
      }

      const routed = await router.dispatch(request);
      if (routed) {
        return routed;
      }

      return Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    } catch (error) {
      return handleHttpError(error);
    }
  };
}
