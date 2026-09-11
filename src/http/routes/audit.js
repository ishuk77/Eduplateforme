import { parsePagination } from '../middleware/validation.js';

export function registerAuditRoutes(router, { service }) {
  router.add('GET', '/audit/events', async (_request, url) => {
    return Response.json(service.getAuditTrail({
      organizationId: url.searchParams.get('organizationId') ?? null,
      ...parsePagination(url)
    }));
  });
}
