import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPersistentEducationPlatformService } from '../services/persistent-education-platform-service.js';
import { handleHttpError } from './middleware/error-handling.js';
import { enforceRateLimit } from './middleware/auth.js';
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
import { registerInstitutionalRoutes } from './routes/institutional.js';
import { registerLearningSystemRoutes } from './routes/learning-systems.js';
import { registerOperationsRoutes } from './routes/operations.js';
import { registerImportRoutes } from './routes/imports.js';
import { registerDomainRoutes } from './routes/domains.js';
import { modules, resolveModule } from '../modules.js';
import { renderAppShell } from '../template.js';
import { ApiError } from '../shared/errors.js';

const currentDirectoryPath = dirname(fileURLToPath(import.meta.url));
const publicDirectoryPath = join(currentDirectoryPath, '../../public');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function getCorsOrigin(request) {
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) {
    return null;
  }
  const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const requestUrl = new URL(request.url);
  const requestHost = request.headers.get('host');
  const sameOrigin = requestHost ? `${requestUrl.protocol}//${requestHost}` : requestUrl.origin;
  if (requestOrigin !== allowedOrigin && requestOrigin !== sameOrigin) {
    throw new ApiError('CORS_FORBIDDEN', 'Origin is not allowed.', 403);
  }
  return requestOrigin;
}

function withSecurityHeaders(response, corsOrigin) {
  const headers = new Headers(response.headers);
  if (corsOrigin) {
    headers.set('access-control-allow-origin', corsOrigin);
    headers.set('access-control-allow-headers', 'authorization, content-type, x-actor-id');
    headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
    headers.set('vary', 'Origin');
  }
  headers.set('x-content-type-options', 'nosniff');
  const connectSources = [`'self'`];
  if (corsOrigin) {
    connectSources.push(corsOrigin);
  }
  if (!headers.has('content-security-policy')) {
    headers.set('content-security-policy', `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src ${connectSources.join(' ')}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`);
  }
  return new Response(response.body, { status: response.status, headers });
}

async function serveStaticAsset(pathname) {
  const relativePath = pathname.replace(/^\/+/, '');
  const assetPath = normalize(join(publicDirectoryPath, relativePath));
  if (!assetPath.startsWith(publicDirectoryPath)) {
    throw new ApiError('FORBIDDEN', 'Forbidden', 403);
  }

  try {
    const asset = await readFile(assetPath);
    return new Response(asset, {
      status: 200,
      headers: {
        'content-type': contentTypes[extname(assetPath)] ?? 'application/octet-stream',
        'cache-control': 'no-cache'
      }
    });
  } catch {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  }
}

function createOpenApiDescription() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Eduplateforme API',
      version: '2.0.0'
    },
    paths: {
      '/auth/login': { post: { summary: 'Authenticate with username and password' } },
      '/auth/refresh': { post: { summary: 'Refresh an access token' } },
      '/auth/logout': { delete: { summary: 'Revoke a refresh token' } },
      '/auth/password/change-required': { post: { summary: 'Replace a temporary password before first access' } },
      '/auth/me': { get: { summary: 'Return the authenticated user' } },
      '/organizations': { get: { summary: 'List organizations' }, post: { summary: 'Create organization' } },
      '/people': { get: { summary: 'List people' }, post: { summary: 'Create person' } },
      '/accounts': { get: { summary: 'List accounts' }, post: { summary: 'Create account' } },
      '/academics/years': { get: { summary: 'List academic years' }, post: { summary: 'Create academic year' } },
      '/academics/programs': { get: { summary: 'List programs' }, post: { summary: 'Create program' } },
      '/academics/classes': { get: { summary: 'List classes' }, post: { summary: 'Create class' } },
      '/academics/enrollments': { get: { summary: 'List enrollments' }, post: { summary: 'Create enrollment' } },
      '/imports/preview': { post: { summary: 'Validate a tenant-scoped CSV or XLSX import without writing' } },
      '/imports/apply': { post: { summary: 'Apply a validated tenant-scoped import transactionally' } },
      '/documents': { get: { summary: 'List documents' }, post: { summary: 'Create document' } },
      '/document-templates': { get: { summary: 'List official document templates' }, post: { summary: 'Create a versioned document template' } },
      '/credentials': { get: { summary: 'List credentials' }, post: { summary: 'Create credential' } },
      '/credentials/{id}/transition': { post: { summary: 'Transition a credential status with a reason' } },
      '/public/credentials/verify/{reference}': { get: { summary: 'Return the strict public credential verification allowlist' } },
      '/document-shares': { get: { summary: 'List controlled document shares' }, post: { summary: 'Create an expiring controlled share' } },
      '/public/document-shares/{token}': { get: { summary: 'Access allowlisted document fields with an opaque token' } },
      '/security/consents': { get: { summary: 'List consent records' }, post: { summary: 'Record purpose-bound consent' } },
      '/collaboration/requests': { get: { summary: 'List interinstitutional requests' }, post: { summary: 'Create an interinstitutional request' } },
      '/transfers': { get: { summary: 'List secure learner transfers' }, post: { summary: 'Create a consent-bound transfer' } },
      '/audit/trail': { get: { summary: 'List audit entries' } },
      '/grading/grades': { get: { summary: 'List grades' }, post: { summary: 'Create grade' } },
      '/attendance/records': { get: { summary: 'List attendance records' }, post: { summary: 'Create attendance record' } },
      '/assignments': { get: { summary: 'List assignments' }, post: { summary: 'Create assignment' } },
      '/assignments/submissions': { get: { summary: 'List submissions' }, post: { summary: 'Submit assignment' } },
      '/assignments/submissions/grade': { post: { summary: 'Grade a submission' } },
      '/grading/systems': { get: { summary: 'List grading systems' }, post: { summary: 'Create grading system' } },
      '/grading/average': { get: { summary: 'Calculate learner average' } },
      '/attendance/rate': { get: { summary: 'Calculate learner attendance rate' } },
      '/scheduling/entries': { get: { summary: 'List schedule entries' }, post: { summary: 'Create schedule entry' } },
      '/finance/fees': { get: { summary: 'List fee types' }, post: { summary: 'Create fee type' } },
      '/finance/invoices': { get: { summary: 'List invoices and balances' }, post: { summary: 'Create invoice' } },
      '/finance/payments': { get: { summary: 'List payments' }, post: { summary: 'Record payment' } },
      '/notifications': { get: { summary: 'List notifications' }, post: { summary: 'Create notification' } },
      '/notifications/sent': { post: { summary: 'Mark notification sent' } },
      '/virtual-schools': { get: { summary: 'List virtual schools' }, post: { summary: 'Create virtual school' } },
      '/virtual-schools/trainings': { get: { summary: 'List trainings' }, post: { summary: 'Create training' } },
      '/certificates': { get: { summary: 'List certificates' }, post: { summary: 'Issue certificate' } },
      '/i18n/profile': { get: { summary: 'Get localization profile' }, post: { summary: 'Upsert localization profile' } },
      '/security/parental-consents': { get: { summary: 'List parental consents' }, post: { summary: 'Record parental consent' } },
      '/reports/cards': { get: { summary: 'List report cards' }, post: { summary: 'Generate report card' } },
      '/communications/threads': { get: { summary: 'List threads' }, post: { summary: 'Create thread' } },
      '/discipline/records': { get: { summary: 'List discipline records' }, post: { summary: 'Create discipline record' } },
      '/calendar/events': { get: { summary: 'List calendar events' }, post: { summary: 'Create calendar event' } },
      '/subscriptions/platform': { get: { summary: 'List subscriptions' }, post: { summary: 'Create platform subscription' } }
      ,
      '/domain-subscription/quotes': { post: { summary: 'Create an idempotent tenant-scoped domain availability quote' } },
      '/domain-subscription/orders': { get: { summary: 'List tenant domain orders' }, post: { summary: 'Create an unpaid unified order with separate SaaS and domain line items' } },
      '/platform/domain-reseller/catalog': { get: { summary: 'List reseller TLD pricing' }, put: { summary: 'Create or update reseller TLD pricing' } },
      '/platform/domain-reseller/orders/{id}/payment': { post: { summary: 'Confirm a payment manually with platform-admin reason and audit' } },
      '/lms/catalogs': { get: { summary: 'List LMS catalogs' }, post: { summary: 'Create LMS catalog' } },
      '/lms/programs': { get: { summary: 'List LMS programs' }, post: { summary: 'Create LMS program linked to academics' } },
      '/lms/courses': { get: { summary: 'List LMS courses' }, post: { summary: 'Create LMS course linked to an academic course' } },
      '/lms/quizzes/{id}/attempts': { post: { summary: 'Submit and score a quiz attempt' } },
      '/lms/enrollments/{id}/lessons/{lessonId}/complete': { post: { summary: 'Complete an unlocked lesson after server-side prerequisite checks' } },
      '/lms/enrollments/{id}/progress-detail': { get: { summary: 'Return server-computed lesson locks and title eligibility' } },
      '/lms/enrollments/{id}/titles': { post: { summary: 'Issue an eligible platform title with an immutable signatory snapshot' } },
      '/profile/me': { get: { summary: 'Get the current private profile' }, put: { summary: 'Update self-service profile fields' } },
      '/profile/me/avatar': { post: { summary: 'Upload a validated PNG or JPEG avatar' } },
      '/organizations/{id}/branding/logo': { post: { summary: 'Upload or replace the tenant logo' }, delete: { summary: 'Remove the tenant logo' } },
      '/signatures': { get: { summary: 'List managed signatories' }, post: { summary: 'Create an auditable visual signature' } },
      '/documents/evidence': { post: { summary: 'Upload bounded proof content to tenant database storage' } },
      '/documents/{id}/content': { get: { summary: 'Download authorized proof content' } },
      '/documents/{id}/verification': { post: { summary: 'Verify, reject, or expire uploaded evidence' } },
      '/credentials/{id}/print': { get: { summary: 'Render an authenticated printable platform title' } },
      '/meetings': { get: { summary: 'List external meetings' }, post: { summary: 'Prepare an external meeting reference' } },
      '/meetings/{id}/attendance/import': { post: { summary: 'Import attendance through a configured adapter' } },
      '/data-quality/runs/execute': { post: { summary: 'Execute tenant and country data quality rules' } },
      '/data-quality/prevalidate-export': { post: { summary: 'Prevalidate an export against data quality rules' } },
      '/emis/exchanges/{id}/transmit': { post: { summary: 'Transmit through a configured EMIS adapter' } },
      '/emis/exchanges/{id}/retransmit': { post: { summary: 'Retry an EMIS transmission' } },
      '/emis/exchanges/{id}/correct': { post: { summary: 'Correct and prepare an EMIS exchange again' } },
      '/references/{catalog}': { get: { summary: 'List standard and tenant reference entries' } },
      '/i18n/format': { post: { summary: 'Format date, number or currency using a localization profile' } },
      '/institution/campuses': { get: { summary: 'List campuses' }, post: { summary: 'Create campus' } },
      '/institution/operating-authorizations': { get: { summary: 'List operating authorizations' }, post: { summary: 'Create operating authorization' } },
      '/institution/accreditations': { get: { summary: 'List accreditations' }, post: { summary: 'Create accreditation' } },
      '/institution/verifications': { get: { summary: 'List verification records' }, post: { summary: 'Create verification record' } },
      '/public/institutions/verify/{code}': { get: { summary: 'Return the public institution verification allowlist' } },
      '/profiles/guardians': { get: { summary: 'List guardian profiles' }, post: { summary: 'Create guardian profile' } },
      '/profiles/professionals': { get: { summary: 'List professional profiles' }, post: { summary: 'Create professional profile' } },
      '/profiles/guardian-relations': { get: { summary: 'List guardian-to-learner relations' }, post: { summary: 'Create guardian relation' } },
      '/profiles/professional-assignments': { get: { summary: 'List professional assignments' }, post: { summary: 'Create professional assignment' } },
      '/academics/periods': { get: { summary: 'List semesters and trimesters' }, post: { summary: 'Create academic period' } },
      '/academics/levels': { get: { summary: 'List levels and specializations' }, post: { summary: 'Create academic level' } },
      '/academics/subjects': { get: { summary: 'List subjects' }, post: { summary: 'Create subject' } },
      '/academics/courses': { get: { summary: 'List contextual courses' }, post: { summary: 'Create course' } },
      '/academics/lifecycle-events': { get: { summary: 'List longitudinal learner events' }, post: { summary: 'Record learner event' } },
      '/security/contextual-permissions': { get: { summary: 'List contextual RBAC rules' }, post: { summary: 'Create contextual RBAC rule' } },
      '/dashboards/me': { get: { summary: 'Return the permission-aware dashboard for the current role' } },
      '/analytics': { get: { summary: 'Calculate privacy-aware tenant analytics' } },
      '/analytics/export': { get: { summary: 'Export analytics as structured CSV or JSON' } },
      '/auth/mfa/enroll': { post: { summary: 'Enroll TOTP and issue one-time recovery codes' } },
      '/auth/mfa/challenge': { post: { summary: 'Complete an MFA authentication challenge' } },
      '/auth/sessions': { get: { summary: 'List account sessions' } },
      '/offline/synchronize': { post: { summary: 'Synchronize authorized idempotent offline mutations' } },
      '/support/tickets': { get: { summary: 'List support tickets' }, post: { summary: 'Create support ticket' } },
      '/saas/entitlements/check': { post: { summary: 'Check a plan feature and its quotas' } },
      '/operations/backups/request': { post: { summary: 'Register a backup, restore or integrity-test request' } },
      '/operations/demo-accounts/provision': { post: { summary: 'Provision tenant-scoped role preview accounts once as tenant administrator' } },
      '/operations/status': { get: { summary: 'Return incident-backed service status' } },
      '/ai/assist': { post: { summary: 'Request consented assistive AI with high-impact guardrails' } }
    }
  };
}

export function createApp({ foundation = createPersistentEducationPlatformService() } = {}) {
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
  registerInstitutionalRoutes(router, context);
  registerLearningSystemRoutes(router, context);
  registerOperationsRoutes(router, context);
  registerImportRoutes(router, context);
  registerDomainRoutes(router, context);

  return async function app(request) {
    let corsOrigin = null;
    try {
      const url = new URL(request.url);

      if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/healthz')) {
        try {
          const health = await foundation.healthCheck();
          return withSecurityHeaders(Response.json({
            ...health,
            uptimeSeconds: Math.floor(process.uptime())
          }), null);
        } catch (error) {
          return withSecurityHeaders(Response.json({
            status: 'unavailable',
            database: 'unavailable'
          }, { status: 503 }), null);
        }
      }

      if (request.method === 'GET' && url.pathname === '/readyz') {
        const readiness = await foundation.readinessCheck();
        return withSecurityHeaders(Response.json(readiness, {
          status: readiness.status === 'ready' ? 200 : 503
        }), null);
      }

      if (request.method === 'GET' && url.pathname === '/metrics') {
        const metrics = await foundation.getMetrics();
        const body = Object.entries(metrics).map(([key, value]) => `${key} ${value}`).join('\n');
        return withSecurityHeaders(new Response(`${body}\n`, {
          headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' }
        }), null);
      }

      const configuredDomain = foundation.getCustomDomainForHost?.(url.hostname) ?? null;
      if (configuredDomain && (configuredDomain.verificationState !== 'verified' || configuredDomain.accessState !== 'active')) {
        throw new ApiError('DOMAIN_UNAVAILABLE', 'This institution domain is not active.', 403);
      }

      enforceRateLimit(request, { namespace: 'api' });
      if (['/auth/login', '/auth/register', '/auth/refresh', '/auth/mfa/challenge', '/auth/mfa/confirm', '/auth/password/change-required'].includes(url.pathname)) {
        enforceRateLimit(request, {
          namespace: 'authentication',
          limit: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '10', 10),
          windowMs: Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? '900000', 10)
        });
      }
      corsOrigin = getCorsOrigin(request);

      if (request.method === 'OPTIONS') {
        if (!corsOrigin) {
          throw new ApiError('CORS_FORBIDDEN', 'Origin header is required for preflight.', 403);
        }
        return withSecurityHeaders(new Response(null, { status: 204 }), corsOrigin);
      }

      if (request.method === 'GET' && ['/styles.css', '/app.js', '/service-worker.js', '/manifest.webmanifest', '/icon.svg'].includes(url.pathname)) {
        return withSecurityHeaders(await serveStaticAsset(url.pathname), corsOrigin);
      }

      const currentModule = request.method === 'GET' && !request.headers.get('authorization')
        ? resolveModule(url.pathname)
        : null;
      if (currentModule) {
        const tenant = configuredDomain ?? foundation.resolveVerifiedTenantByHost?.(url.hostname) ?? null;
        const html = renderAppShell({ currentModule, modules, platform: foundation.describePlatform() });
        return withSecurityHeaders(new Response(html, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            ...(tenant ? { 'x-eduplateforme-tenant': tenant.organizationId } : {})
          }
        }), corsOrigin);
      }

      if (request.method === 'GET' && url.pathname === '/meta/foundation') {
        return withSecurityHeaders(Response.json(foundation.describePlatform()), corsOrigin);
      }

      if (request.method === 'GET' && url.pathname === '/meta/invariants') {
        const description = foundation.describePlatform();
        return withSecurityHeaders(Response.json({ scope: description.scope, invariants: description.invariants }), corsOrigin);
      }

      if (request.method === 'GET' && url.pathname === '/meta/openapi') {
        return withSecurityHeaders(Response.json(createOpenApiDescription()), corsOrigin);
      }

      const routed = await router.dispatch(request);
      if (routed) {
        return withSecurityHeaders(routed, corsOrigin);
      }

      return withSecurityHeaders(Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 }), corsOrigin);
    } catch (error) {
      return withSecurityHeaders(handleHttpError(error), corsOrigin);
    }
  };
}
