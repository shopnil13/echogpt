import { registerAs } from '@nestjs/config';

import { envInt, envString } from './env.utils';

export const databaseConfig = registerAs('database', () => ({
  url: envString('DATABASE_URL'),
  poolMax: envInt('DATABASE_POOL_MAX'),
}));

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
