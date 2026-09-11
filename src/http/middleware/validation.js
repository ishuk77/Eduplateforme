import { ZodError } from 'zod';
import { ApiError } from '../../shared/errors.js';

export function parsePagination(url) {
  return {
    limit: Number(url.searchParams.get('limit') ?? 25),
    offset: Number(url.searchParams.get('offset') ?? 0)
  };
}

export async function parseJson(request, schema = null) {
  const text = await request.text();
  if (!text) {
    return schema ? schema.parse({}) : {};
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  if (!schema) {
    return parsed;
  }

  try {
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError('INVALID_INPUT', error.issues.map((issue) => issue.message).join('; '), 400);
    }
    throw error;
  }
}
