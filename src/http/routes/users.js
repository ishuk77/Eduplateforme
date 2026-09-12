import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, enforceRateLimit, requireIdentity } from '../middleware/auth.js';
import { bootstrapOrAuthorize, makeCrudHandlers } from './_helpers.js';
import { accountCreationSchema } from '../../shared/types.js';
import { ASSET_LIMITS } from '../../services/secure-assets-service.js';
import { binaryResponse, parseAssetRequest } from './_uploads.js';
import { ApiError } from '../../shared/errors.js';

function currentProfileScope(request, service) {
  const identity = requireIdentity(request, service);
  const account = service.accounts.get(identity.accountId);
  if (!account?.personId) throw new ApiError('PROFILE_UNAVAILABLE', 'This account is not linked to a person profile.', 409);
  const person = service.people.get(account.personId);
  if (!person?.primaryOrganizationId || !identity.organizationIds.includes(person.primaryOrganizationId)) {
    throw new ApiError('PROFILE_UNAVAILABLE', 'The person profile is not assigned to an accessible organization.', 409);
  }
  return { identity, account, organizationId: person.primaryOrganizationId };
}

export function registerUserRoutes(router, { service }) {
  router.add('GET', '/profile/me', async (request) => {
    const { account, organizationId } = currentProfileScope(request, service);
    return Response.json(service.getPersonProfile(account.personId, organizationId, { includePrivate: true }));
  });

  router.add('PUT', '/profile/me', async (request) => {
    const { identity, account, organizationId } = currentProfileScope(request, service);
    const person = await service.updatePersonProfile(account.personId, organizationId, await parseJson(request), {
      selfService: true,
      actorId: identity.actorId
    });
    return Response.json(service.getPersonProfile(person.id, organizationId, { includePrivate: true }));
  });

  router.add('POST', '/profile/me/avatar', async (request) => {
    enforceRateLimit(request, { namespace: 'avatar-upload', limit: 20 });
    const { identity, account, organizationId } = currentProfileScope(request, service);
    const body = await parseAssetRequest(request, ASSET_LIMITS.avatar);
    return Response.json(await service.savePersonAvatar(account.personId, organizationId, body, identity.actorId), { status: 201 });
  });

  router.add('GET', '/people/:id/profile', async (request, _url, params) => {
    const person = await service.getCrudResource('people', params.id);
    if (!person.primaryOrganizationId) throw new ApiError('PROFILE_UNAVAILABLE', 'Person is not assigned to an organization.', 409);
    authorizeRequest(request, service, {
      organizationId: person.primaryOrganizationId,
      permissions: ['people.read', 'profiles.read']
    });
    return Response.json(service.getPersonProfile(params.id, person.primaryOrganizationId, { includePrivate: true }));
  });

  router.add('PUT', '/people/:id/profile', async (request, _url, params) => {
    const person = await service.getCrudResource('people', params.id);
    if (!person.primaryOrganizationId) throw new ApiError('PROFILE_UNAVAILABLE', 'Person is not assigned to an organization.', 409);
    const identity = authorizeRequest(request, service, {
      organizationId: person.primaryOrganizationId,
      permissions: ['people.write']
    });
    await service.updatePersonProfile(params.id, person.primaryOrganizationId, await parseJson(request), {
      selfService: false,
      actorId: identity.actorId
    });
    return Response.json(service.getPersonProfile(params.id, person.primaryOrganizationId, { includePrivate: true }));
  });

  router.add('GET', '/people/:id/avatar', async (request, _url, params) => {
    const person = await service.getCrudResource('people', params.id);
    if (!person.primaryOrganizationId) throw new ApiError('PROFILE_UNAVAILABLE', 'Person is not assigned to an organization.', 409);
    const identity = requireIdentity(request, service);
    const isSelf = service.accounts.get(identity.accountId)?.personId === person.id;
    if (!isSelf) {
      authorizeRequest(request, service, {
        organizationId: person.primaryOrganizationId,
        permissions: ['people.read', 'profiles.read']
      });
    }
    const profile = service.getPersonProfile(params.id, person.primaryOrganizationId, { includePrivate: isSelf });
    return binaryResponse(await service.getPersonAvatar(params.id, person.primaryOrganizationId), {
      fileName: profile.avatar?.fileName ?? 'avatar'
    });
  });

  const peopleHandlers = makeCrudHandlers({
    service,
    resource: 'people',
    create: (body, actorId) => service.registerPerson(body, actorId),
    readPermission: 'people.read',
    writePermission: 'people.write',
    getOrganizationIdFromBody: (body) => body.primaryOrganizationId ?? body.organizationId ?? null,
    getOrganizationIdFromRecord: (record) => record.primaryOrganizationId ?? null
  });

  const accountHandlers = makeCrudHandlers({
    service,
    resource: 'accounts',
    create: (body, actorId) => service.openUserAccount(body, actorId),
    readPermission: 'accounts.read',
    writePermission: 'accounts.write',
    getOrganizationIdFromBody: (body) => body.organizationId ?? body.organizationIds?.[0] ?? null,
    getOrganizationIdFromRecord: (record) => record.organizationIds?.[0] ?? null
  });

  router.add('POST', '/users', async (request) => {
    const body = await parseJson(request);
    const identity = bootstrapOrAuthorize(request, service, body, ['people.write']);
    return Response.json(await service.registerPerson(body, identity.actorId), { status: 201 });
  });

  router.add('POST', '/people', async (request) => {
    const body = await parseJson(request);
    const identity = bootstrapOrAuthorize(request, service, body, ['people.write']);
    return Response.json(await service.registerPerson(body, identity.actorId), { status: 201 });
  });
  router.add('GET', '/people', peopleHandlers.list);
  router.add('GET', '/people/:id', peopleHandlers.get);
  router.add('PUT', '/people/:id', peopleHandlers.update);
  router.add('DELETE', '/people/:id', peopleHandlers.remove);
  router.add('GET', '/people/:id/history', peopleHandlers.history);

  router.add('POST', '/accounts', async (request) => {
    const body = await parseJson(request, accountCreationSchema);
    const identity = bootstrapOrAuthorize(request, service, body, ['accounts.write']);
    return Response.json(await service.openUserAccount(body, identity.actorId), { status: 201 });
  });
  router.add('GET', '/accounts', accountHandlers.list);
  router.add('GET', '/accounts/:id', accountHandlers.get);
  router.add('PUT', '/accounts/:id', accountHandlers.update);
  router.add('DELETE', '/accounts/:id', accountHandlers.remove);
  router.add('GET', '/accounts/:id/history', accountHandlers.history);
}
