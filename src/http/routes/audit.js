import { parsePagination } from '../middleware/validation.js';
import { authorizeRequest } from '../middleware/auth.js';

export function registerAuditRoutes(router, { service }) {
  const handler = async (request, url) => {
    const organizationId = url.searchParams.get('organizationId') ?? null;
    authorizeRequest(request, service, { organizationId, permissions: ['audit.read'] });
    return Response.json(await service.getAuditTrail({ organizationId, ...parsePagination(url) }));
  };

  router.add('GET', '/audit/events', handler);
  router.add('GET', '/audit/trail', handler);
}
