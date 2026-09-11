function requireProductionSecret(env, name) {
  const value = env[name];
  if (!value || value.length < 32 || /change-me|replace-me/i.test(value)) {
    throw new Error(`${name} must be set to a non-placeholder value of at least 32 characters in production.`);
  }
}

export function readRuntimeConfig(env = process.env) {
  const portValue = env.PORT ?? '3000';
  if (!/^\d+$/.test(portValue)) {
    throw new Error(`Invalid PORT value: ${portValue}`);
  }
  const port = Number.parseInt(portValue, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${portValue}`);
  }

  if (env.NODE_ENV === 'production') {
    requireProductionSecret(env, 'JWT_SECRET');
    requireProductionSecret(env, 'DATA_ENCRYPTION_KEY');
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production.');
    }
    if (!env.CORS_ORIGIN) {
      throw new Error('CORS_ORIGIN is required in production.');
    }
  }

  return {
    host: env.HOST ?? '0.0.0.0',
    port
  };
}
