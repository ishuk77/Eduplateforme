import { parsePagination, parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function makeCrudHandlers({
  create,
  list,
  listByOrganization = true
}) {
  return {
    create: async (request) => {
      const actorId = requireActor(request);
      const body = await parseJson(request);
      return Response.json(create(body, actorId), { status: 201 });
    },
    list: async (_request, url) => {
      const paging = parsePagination(url);
      const organizationId = listByOrganization ? (url.searchParams.get('organizationId') ?? undefined) : undefined;
      const learnerId = url.searchParams.get('learnerId') ?? undefined;
      return Response.json(list({ organizationId, learnerId, ...paging }));
    }
  };
}
