import { parseJson } from '../middleware/validation.js';
import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import {
  loginSchema,
  onboardingSchema,
  refreshSchema,
  registrationSchema
} from '../../shared/types.js';
import { ApiError } from '../../shared/errors.js';

function getCookie(request, name) {
  const prefix = `${name}=`;
  return request.headers.get('cookie')?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function getRefreshToken(request, body) {
  const token = body.refreshToken ?? getCookie(request, 'eduplateforme_refresh');
  if (!token) {
    throw new ApiError('AUTH_REQUIRED', 'Refresh token is required.', 401);
  }
  return token;
}

function withRefreshCookie(payload, { clear = false, status = 200 } = {}) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const { refreshToken, ...publicPayload } = payload;
  const value = clear ? '' : encodeURIComponent(refreshToken);
  const maxAge = clear ? 0 : 60 * 60 * 24 * 30;
  headers.set(
    'set-cookie',
    `eduplateforme_refresh=${value}; Path=/auth; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
  );
  return new Response(JSON.stringify(publicPayload), { status, headers });
}

export function registerAuthRoutes(router, { service }) {
  router.add('POST', '/auth/login', async (request) => {
    const body = await parseJson(request, loginSchema);
    return withRefreshCookie(await service.authenticate(body));
  });

  router.add('POST', '/auth/register', async (request) => {
    const body = await parseJson(request, registrationSchema);
    const { account } = await service.registerUser(body);
    return withRefreshCookie(await service.createAuthenticationSession(account), { status: 201 });
  });

  router.add('POST', '/auth/refresh', async (request) => {
    const body = await parseJson(request, refreshSchema);
    return Response.json(await service.refreshAuthentication(getRefreshToken(request, body)));
  });

  router.add('POST', '/auth/onboarding', async (request) => {
    const body = await parseJson(request, onboardingSchema);
    const identity = requireIdentity(request, service);
    const { account, organization } = await service.onboardAccount(identity.accountId, body);
    const authentication = await service.createAuthenticationSession(account, organization.id);
    return withRefreshCookie(authentication);
  });

  router.add('DELETE', '/auth/logout', async (request) => {
    const body = await parseJson(request, refreshSchema);
    const identity = requireIdentity(request, service);
    const payload = {
      ...await service.logout(getRefreshToken(request, body), identity.accountId),
      accountId: identity.accountId
    };
    return withRefreshCookie(payload, { clear: true });
  });

  router.add('GET', '/auth/me', async (request, url) => {
    const identity = requireIdentity(request, service);
    const requestedOrganizationId = url.searchParams.get('organizationId') ?? null;
    let organizationId = requestedOrganizationId ?? identity.organizationId ?? null;
    if (!organizationId && (identity.organizationIds?.length ?? 0) === 1) {
      [organizationId] = identity.organizationIds;
    }
    if (!organizationId && (identity.organizationIds?.length ?? 0) > 1) {
      throw new ApiError('INVALID_INPUT', 'organizationId is required for multi-organization accounts.', 400);
    }
    authorizeRequest(request, service, { organizationId });
    return Response.json(service.getAuthenticatedUserByAccountId(identity.accountId, organizationId));
  });

  router.add('GET', '/auth/validate', async (request) => {
    const identity = requireIdentity(request, service);
    return Response.json({ authenticated: true, actorId: identity.actorId, organizationId: identity.organizationId });
  });
}
