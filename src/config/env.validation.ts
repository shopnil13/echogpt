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
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),
  AUTH_THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  REQUIRE_EMAIL_VERIFICATION: Joi.boolean().default(false),
  EMAIL_VERIFICATION_TTL_HOURS: Joi.number().integer().min(1).max(168).default(24),
  EMAIL_VERIFICATION_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/verify-email'),
  MAIL_TRANSPORT: Joi.string().valid('log', 'smtp').default('log'),
  MAIL_FROM: Joi.string().default('EchoGPT <no-reply@echogpt.local>'),
  SMTP_HOST: Joi.when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.string().hostname().required(),
    otherwise: Joi.string().allow(''),
  }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow(''),
  SMTP_PASS: Joi.string().allow(''),
  AI_MOCK_PROVIDER_ENABLED: Joi.boolean().default(false),
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
