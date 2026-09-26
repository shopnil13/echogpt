import { registerAs } from '@nestjs/config';

import { envBool, envInt, envString } from './env.utils';

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: envString('JWT_ACCESS_SECRET'),
  jwtAccessTtlSeconds: envInt('JWT_ACCESS_TTL_SECONDS'),
  jwtIssuer: 'echogpt-api',
  jwtAudience: 'echogpt-clients',
  refreshTokenTtlDays: envInt('REFRESH_TOKEN_TTL_DAYS'),
  throttle: {
    limit: envInt('AUTH_THROTTLE_LIMIT'),
    ttlMs: envInt('AUTH_THROTTLE_TTL_SECONDS') * 1000,
  },
  requireEmailVerification: envBool('REQUIRE_EMAIL_VERIFICATION'),
  emailVerificationTtlHours: envInt('EMAIL_VERIFICATION_TTL_HOURS'),
  emailVerificationUrl: envString('EMAIL_VERIFICATION_URL'),
}));

export type AuthConfig = ReturnType<typeof authConfig>;
