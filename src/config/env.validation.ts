import * as Joi from 'joi';

/**
 * Single source of truth for environment variables.
 * Boot fails fast with every validation error listed when the environment is invalid.
 * Only files inside `src/config` may read `process.env`.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  APP_PUBLIC_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  TRUST_PROXY: Joi.boolean().default(false),
  BODY_LIMIT: Joi.string()
    .pattern(/^\d+(kb|mb)$/i)
    .default('100kb'),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
});

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const result = envValidationSchema.validate(raw, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });
  if (result.error) {
    const details = result.error.details.map((detail) => `  - ${detail.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.value as Record<string, unknown>;
}
