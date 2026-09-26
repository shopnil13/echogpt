import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { databaseConfig, type DatabaseConfig } from '../../config/database.config';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Application-wide Prisma client backed by a pg connection pool (driver adapter, ADR-003).
 * Only repositories may inject this, except services opening a transaction (rules.md §2).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(databaseConfig.KEY) config: DatabaseConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.url, max: config.poolMax }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
