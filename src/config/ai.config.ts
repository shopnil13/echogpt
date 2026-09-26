import { registerAs } from '@nestjs/config';

import { envBool, envInt, envString } from './env.utils';

export const aiConfig = registerAs('ai', () => ({
  encryptionKey: Buffer.from(envString('ENCRYPTION_KEY'), 'base64'),
  mockProviderEnabled: envBool('AI_MOCK_PROVIDER_ENABLED'),
  requestTimeoutMs: envInt('AI_REQUEST_TIMEOUT_MS'),
  healthCheckTimeoutMs: envInt('AI_HEALTH_CHECK_TIMEOUT_MS'),
  maxOutputTokens: envInt('AI_MAX_OUTPUT_TOKENS'),
}));

export type AiConfig = ReturnType<typeof aiConfig>;
