import { Injectable } from '@nestjs/common';

import { type LimitPeriod } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class UsageCountersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically counts one request if the window is still under `limit`.
   * The conditional upsert is a single statement, so concurrent requests on any number of
   * API instances can never push the counter past the limit (ADR-009).
   *
   * @returns the new count, or null when the limit was already reached.
   */
  async incrementIfBelow(
    userId: string,
    periodStart: Date,
    period: LimitPeriod,
    limit: number,
  ): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<Array<{ request_count: number }>>`
      INSERT INTO usage_counters (id, user_id, period_start, period, request_count, updated_at)
      VALUES (gen_random_uuid(), ${userId}::uuid, ${periodStart}, ${period}::limit_period, 1, now())
      ON CONFLICT (user_id, period_start)
      DO UPDATE SET request_count = usage_counters.request_count + 1, updated_at = now()
        WHERE usage_counters.request_count < ${limit}
      RETURNING request_count`;
    return rows[0]?.request_count ?? null;
  }

  /** Gives back one unit (e.g. the upstream AI call failed). Never goes below zero. */
  async decrement(userId: string, periodStart: Date): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE usage_counters
      SET request_count = request_count - 1, updated_at = now()
      WHERE user_id = ${userId}::uuid AND period_start = ${periodStart} AND request_count > 0`;
  }

  async getCount(userId: string, periodStart: Date): Promise<number> {
    const counter = await this.prisma.usageCounter.findUnique({
      where: { userId_periodStart: { userId, periodStart } },
      select: { requestCount: true },
    });
    return counter?.requestCount ?? 0;
  }
}
