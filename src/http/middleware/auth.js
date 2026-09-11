import { ApiError } from '../../shared/errors.js';

const requestIdentityStore = new WeakMap();
const rateLimitStore = new Map();
let lastRateLimitCleanup = 0;

function getClientAddress(request) {
  const directAddress = request.headers.get('x-remote-addr');
  if (process.env.TRUST_PROXY === 'true') {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? directAddress
      ?? '127.0.0.1';
  }

  return directAddress ?? '127.0.0.1';
}

function cleanupExpiredRateLimits(now, windowMs) {
  if ((now - lastRateLimitCleanup) < windowMs) {
    return;
  }
  lastRateLimitCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if ((now - entry.windowStartedAt) >= entry.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

export function enforceRateLimit(request, {
  namespace = 'api',
  limit = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '120', 10),
  windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10)
} = {}) {
  const key = `${namespace}:${getClientAddress(request)}`;
  const now = Date.now();
  cleanupExpiredRateLimits(now, Math.min(windowMs, 60_000));
  const entry = rateLimitStore.get(key);
  if (!entry || (now - entry.windowStartedAt) >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStartedAt: now, windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > limit) {
    throw new ApiError('RATE_LIMITED', 'Too many requests.', 429);
  }
}

export function requireActor(request, service = null) {
  const authorization = request.headers.get('authorization');
  if (service && authorization?.startsWith('Bearer ')) {
    const identity = requireIdentity(request, service);
    return identity.actorId;
  }

  const actorId = request.headers.get('x-actor-id');
  if (!actorId) {
    throw new ApiError('AUTH_REQUIRED', 'Authorization or x-actor-id header is required.', 401);
  }

  return actorId;
}

export function requireIdentity(request, service) {
  const cached = requestIdentityStore.get(request);
  if (cached) {
    return cached;
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError('AUTH_REQUIRED', 'Authorization header is required.', 401);
  }

  const token = authorization.slice('Bearer '.length).trim();
  const identity = service.verifyAccessToken(token);
  if (!identity) {
    throw new ApiError('AUTH_INVALID', 'Access token is invalid or expired.', 401);
  }

  requestIdentityStore.set(request, identity);
  return identity;
}

export function authorizeRequest(request, service, { organizationId = null, permissions = [], context = null } = {}) {
  const identity = requireIdentity(request, service);
  const scopedOrganizationId = organizationId ?? identity.organizationId ?? null;
  if (scopedOrganizationId && !identity.organizationIds.includes(scopedOrganizationId)) {
    throw new ApiError('FORBIDDEN', 'Cross-organization access is forbidden.', 403);
  }

  const scopedPermissions = service.getAccountPermissions(identity.accountId, scopedOrganizationId);
  for (const permission of permissions) {
    if (!scopedPermissions.includes('*') && !scopedPermissions.includes(permission)) {
      throw new ApiError('FORBIDDEN', `Missing permission: ${permission}`, 403);
    }
    if (context && !service.isContextuallyAllowed(identity.accountId, {
      organizationId: scopedOrganizationId,
      ...context
    })) {
      throw new ApiError('FORBIDDEN', 'Contextual permission rule denied this action.', 403);
    }
  }

  return {
    ...identity,
    organizationId: scopedOrganizationId,
    permissions: scopedPermissions
  };
}
