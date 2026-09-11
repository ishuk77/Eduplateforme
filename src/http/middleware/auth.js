import { ApiError } from '../../shared/errors.js';

export function requireActor(request) {
  const actorId = request.headers.get('x-actor-id');
  if (!actorId) {
    throw new ApiError('AUTH_REQUIRED', 'x-actor-id header is required.', 401);
  }

  return actorId;
}
