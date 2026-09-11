import { parseJson } from '../middleware/validation.js';
import { bootstrapOrAuthorize } from './_helpers.js';
import { accountCreationSchema } from '../../shared/types.js';

export function registerUserRoutes(router, { service }) {
  router.add('POST', '/users', async (request) => {
    const body = await parseJson(request);
    const identity = bootstrapOrAuthorize(request, service, body, ['people.write']);
    return Response.json(service.registerPerson(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/accounts', async (request) => {
    const body = await parseJson(request, accountCreationSchema);
    const identity = bootstrapOrAuthorize(request, service, body, ['accounts.write']);
    return Response.json(service.openUserAccount(body, identity.actorId), { status: 201 });
  });
}
