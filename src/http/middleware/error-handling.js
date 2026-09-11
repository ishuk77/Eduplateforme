import { ApiError, ValidationError } from '../../shared/errors.js';

export function handleHttpError(error) {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  if (error instanceof ValidationError) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
  }

  return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 });
}
