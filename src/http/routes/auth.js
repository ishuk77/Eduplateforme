import { requireActor } from '../middleware/auth.js';

export function registerAuthRoutes(router) {
  router.add('GET', '/auth/validate', async (request) => {
    const actorId = requireActor(request);
    return Response.json({ actorId, authenticated: true });
  });
}
