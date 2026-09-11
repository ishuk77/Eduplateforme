import { ZodError } from 'zod';
import { ApiError } from '../../shared/errors.js';

const suspiciousPattern = /<script|javascript:|;--|union\s+select|drop\s+table/i;

function assertSafeValue(value, path = 'body') {
  if (typeof value === 'string' && suspiciousPattern.test(value)) {
    throw new ApiError('INVALID_INPUT', `${path} contains blocked content.`, 400);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeValue(item, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, nestedValue]) => assertSafeValue(nestedValue, `${path}.${key}`));
  }
}

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

  assertSafeValue(parsed);

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
