import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Arbitrary constant identifying this job's PostgreSQL advisory lock. */
const CLEANUP_LOCK_ID = 747_001;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Periodic housekeeping. The advisory lock makes the job run on one instance only when
 * several API replicas share the database.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup', waitForCompletion: true })
  async cleanup(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${CLEANUP_LOCK_ID}) AS locked`;
      if (!lock?.locked) return;

      const now = new Date();
      const cutoff = new Date(now.getTime() - RETENTION_MS);
      const cache = await tx.searchCacheEntry.deleteMany({ where: { expiresAt: { lte: now } } });
      const sessions = await tx.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
      });
      const tokens = await tx.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
      });
      this.logger.log(
        { cacheEntries: cache.count, sessions: sessions.count, verificationTokens: tokens.count },
        'Cleanup completed',
      );
    });
  }
}
