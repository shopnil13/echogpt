import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { registerAs } from '@nestjs/config';

import { envBool, envInt, envList, envOptionalString, envString } from './env.utils';

export type NodeEnv = 'development' | 'test' | 'production';

export const appConfig = registerAs('app', () => ({
  nodeEnv: envString('NODE_ENV') as NodeEnv,
  port: envInt('PORT'),
  /** Explicit APP_VERSION wins, then npm's variable, then package.json in the working directory. */
  version:
    envOptionalString('APP_VERSION') ??
    envOptionalString('npm_package_version') ??
    readPackageVersion(),
  publicUrl: envString('APP_PUBLIC_URL'),
  corsOrigins: envList('CORS_ORIGINS'),
  trustProxy: envBool('TRUST_PROXY'),
  bodyLimit: envString('BODY_LIMIT'),
  swaggerEnabled: envBool('SWAGGER_ENABLED'),
  logLevel: envString('LOG_LEVEL'),
  throttle: {
    ttlMs: envInt('THROTTLE_TTL_SECONDS') * 1000,
    limit: envInt('THROTTLE_LIMIT'),
  },
}));

export type AppConfig = ReturnType<typeof appConfig>;

function readPackageVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return manifest.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
