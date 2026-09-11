import { ApiError } from '../../shared/errors.js';

const requestIdentityStore = new WeakMap();
const rateLimitStore = new Map();

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

export function enforceRateLimit(request, { limit = 100, windowMs = 60_000 } = {}) {
  const key = getClientAddress(request);
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || (now - entry.windowStartedAt) >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStartedAt: now });
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

export function authorizeRequest(request, service, { organizationId = null, permissions = [] } = {}) {
  const identity = requireIdentity(request, service);
  if (organizationId && !identity.organizationIds.includes(organizationId)) {
    throw new ApiError('FORBIDDEN', 'Cross-organization access is forbidden.', 403);
  }

  for (const permission of permissions) {
    if (!identity.permissions.includes('*') && !identity.permissions.includes(permission)) {
      throw new ApiError('FORBIDDEN', `Missing permission: ${permission}`, 403);
    }
  }

  return identity;
}
