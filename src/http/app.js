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
import { modules, resolveModule } from '../modules.js';
import { renderAppShell } from '../template.js';
import { ApiError } from '../shared/errors.js';

const currentDirectoryPath = dirname(fileURLToPath(import.meta.url));
const publicDirectoryPath = join(currentDirectoryPath, '../../public');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function getCorsOrigin(request) {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  if (!requestOrigin) {
    return allowedOrigin;
  }
  if (requestOrigin !== allowedOrigin) {
    throw new ApiError('CORS_FORBIDDEN', 'Origin is not allowed.', 403);
  }
  return requestOrigin;
}

function withSecurityHeaders(response, corsOrigin) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', corsOrigin);
  headers.set('access-control-allow-headers', 'authorization, content-type, x-actor-id');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  headers.set('vary', 'Origin');
  headers.set('x-content-type-options', 'nosniff');
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
      '/auth/me': { get: { summary: 'Return the authenticated user' } },
      '/audit/trail': { get: { summary: 'List audit entries' } },
      '/grading/grades': { get: { summary: 'List grades' }, post: { summary: 'Create grade' } },
      '/attendance/records': { get: { summary: 'List attendance records' }, post: { summary: 'Create attendance record' } },
      '/assignments': { get: { summary: 'List assignments' }, post: { summary: 'Create assignment' } },
      '/reports/cards': { get: { summary: 'List report cards' }, post: { summary: 'Generate report card' } },
      '/communications/threads': { get: { summary: 'List threads' }, post: { summary: 'Create thread' } },
      '/discipline/records': { get: { summary: 'List discipline records' }, post: { summary: 'Create discipline record' } },
      '/calendar/events': { get: { summary: 'List calendar events' }, post: { summary: 'Create calendar event' } },
      '/subscriptions/platform': { get: { summary: 'List subscriptions' }, post: { summary: 'Create platform subscription' } }
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

  return async function app(request) {
    let corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    try {
      enforceRateLimit(request);
      corsOrigin = getCorsOrigin(request);
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return withSecurityHeaders(new Response(null, { status: 204 }), corsOrigin);
      }

      if (request.method === 'GET' && (url.pathname === '/styles.css' || url.pathname === '/app.js' || url.pathname === '/manifest.webmanifest')) {
        return withSecurityHeaders(await serveStaticAsset(url.pathname), corsOrigin);
      }

      const currentModule = request.method === 'GET' ? resolveModule(url.pathname) : null;
      if (currentModule) {
        const html = renderAppShell({ currentModule, modules, platform: foundation.describePlatform() });
        return withSecurityHeaders(new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        }), corsOrigin);
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return withSecurityHeaders(Response.json({ status: 'ok' }), corsOrigin);
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
