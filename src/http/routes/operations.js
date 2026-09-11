import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { parseJson, parsePagination } from '../middleware/validation.js';
import { ApiError } from '../../shared/errors.js';
import { makeCrudHandlers } from './_helpers.js';

const CRUD_RESOURCES = Object.freeze([
  ['/analytics/configurations', 'analyticsConfigurations', 'analytics'],
  ['/support/tickets', 'supportTickets', 'support'],
  ['/saas/plans', 'saasPlans', 'saas'],
  ['/saas/subscriptions', 'tenantSubscriptions', 'saas'],
  ['/operations/backup-configurations', 'backupConfigurations', 'operations'],
  ['/operations/backups', 'backupOperations', 'operations'],
  ['/operations/incidents', 'incidents', 'operations'],
  ['/ai/requests', 'aiAssistanceRequests', 'ai-assistance'],
  ['/offline/journal', 'syncJournal', 'operations']
]);

function getScopedOrganization(request, service, candidate = null) {
  const identity = requireIdentity(request, service);
  const organizationId = candidate
    ?? identity.organizationId
    ?? (identity.organizationIds.length === 1 ? identity.organizationIds[0] : null);
  if (!organizationId) throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
  return { identity, organizationId };
}

function registerCrud(router, service, [path, resource, permission]) {
  const handlers = makeCrudHandlers({
    service,
    resource,
    create: (body, actorId) =>
      service.createOperationalRecord(resource, body, actorId, `${resource}.create`),
    readPermission: `${permission}.read`,
    writePermission: `${permission}.write`
  });
  router.add('POST', path, handlers.create);
  router.add('GET', path, handlers.list);
  router.add('GET', `${path}/:id`, handlers.get);
  router.add('PUT', `${path}/:id`, handlers.update);
  router.add('DELETE', `${path}/:id`, handlers.remove);
  router.add('GET', `${path}/:id/history`, handlers.history);
}

export function registerOperationsRoutes(router, { service }) {
  for (const resource of CRUD_RESOURCES) registerCrud(router, service, resource);

  router.add('GET', '/support/help', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['support.read'] });
    return Response.json({
      guides: [
        { id: 'getting-started', title: 'Premiers pas', audience: 'admin' },
        { id: 'low-connectivity', title: 'Travailler avec une connexion faible', audience: 'all' },
        { id: 'support-escalation', title: 'Escalade L1 à L4', audience: 'support' }
      ],
      faq: [
        { question: 'Quelles actions fonctionnent hors ligne ?', answer: 'Les brouillons explicitement autorisés; les données officielles exigent une connexion.' },
        { question: 'Comment escalader un ticket ?', answer: 'Affectez le niveau L1, L2, L3 ou L4 et ajoutez un commentaire traçable.' }
      ]
    });
  });

  router.add('GET', '/dashboards/me', async (request, url) => {
    const { identity, organizationId } = getScopedOrganization(
      request,
      service,
      url.searchParams.get('organizationId')
    );
    authorizeRequest(request, service, { organizationId });
    return Response.json(service.getRoleDashboard(identity.accountId, organizationId));
  });

  router.add('GET', '/analytics', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['analytics.read'] });
    const filters = Object.fromEntries(
      ['period', 'levelCode', 'classId', 'programId', 'campusId', 'subjectId']
        .map((key) => [key === 'levelCode' ? 'levelCode' : key, url.searchParams.get(key)])
        .filter(([, value]) => value)
    );
    return Response.json(service.buildAnalytics({ organizationId, filters }));
  });

  router.add('GET', '/analytics/export', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['analytics.export'] });
    const exported = service.exportAnalytics({
      organizationId,
      format: url.searchParams.get('format') ?? 'json',
      filters: Object.fromEntries(
        ['period', 'levelCode', 'classId', 'programId', 'campusId', 'subjectId']
          .map((key) => [key, url.searchParams.get(key)])
          .filter(([, value]) => value)
      )
    });
    return new Response(exported.body, {
      headers: {
        'content-type': exported.contentType,
        'content-disposition': `attachment; filename="${exported.filename}"`
      }
    });
  });

  router.add('POST', '/support/tickets/:id/comments', async (request, _url, params) => {
    const ticket = await service.getCrudResource('supportTickets', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: ticket.organizationId,
      permissions: ['support.write']
    });
    return Response.json(await service.addSupportComment(params.id, await parseJson(request), identity.actorId));
  });

  router.add('POST', '/saas/entitlements/check', async (request) => {
    const body = await parseJson(request);
    authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['saas.read']
    });
    return Response.json(service.checkEntitlement(body.organizationId, body.feature, body.usage ?? {}));
  });

  router.add('POST', '/operations/backups/request', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['operations.write']
    });
    return Response.json(await service.requestBackup(body, identity.actorId), { status: 202 });
  });

  router.add('POST', '/ai/assist', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['ai-assistance.write']
    });
    return Response.json(await service.requestAiAssistance(body, identity.actorId), { status: 202 });
  });

  router.add('POST', '/offline/synchronize', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId
    });
    return Response.json(await service.processOfflineMutations(body, identity.actorId));
  });

  router.add('GET', '/operations/status', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['operations.read'] });
    const incidents = await service.listCrudResource('incidents', {
      organizationId,
      ...parsePagination(url)
    });
    return Response.json({
      serviceState: incidents.items.some((item) => item.incidentState === 'open') ? 'degraded' : 'operational',
      incidents
    });
  });
}
