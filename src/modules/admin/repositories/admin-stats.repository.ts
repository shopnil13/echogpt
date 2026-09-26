import { Injectable } from '@nestjs/common';

import { SubscriptionStatus, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  verified: number;
  newLast7Days: number;
}

export interface UsageStats {
  requestsToday: number;
  errorsToday: number;
  chatRequestsToday: number;
  searchRequestsToday: number;
  promptTokensToday: number;
  completionTokensToday: number;
  requestsLast7Days: number;
}

export interface ContentStats {
  conversations: number;
  messages: number;
  searches: number;
}

/**
 * Read-only reporting queries spanning several modules' tables. Kept in one place (a read
 * model) instead of adding dashboard-only methods to every domain repository; it never writes.
 */
@Injectable()
export class AdminStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async userStats(since7Days: Date): Promise<UserStats> {
    const [total, active, suspended, verified, newLast7Days] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since7Days } } }),
    ]);
    return { total, active, suspended, verified, newLast7Days };
  }

  async activeSubscriptionsByPlan(): Promise<Array<{ planCode: string; count: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ plan_code: string; count: number }>>`
      SELECT p.code AS plan_code, count(s.id)::int AS count
      FROM plans p
      LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = ${SubscriptionStatus.ACTIVE}::subscription_status
      GROUP BY p.code
      ORDER BY p.code`;
    return rows.map((row) => ({ planCode: row.plan_code, count: row.count }));
  }

  async usageStats(startOfToday: Date, since7Days: Date): Promise<UsageStats> {
    const [today] = await this.prisma.$queryRaw<
      Array<{
        requests: number;
        errors: number;
        chat: number;
        search: number;
        prompt_tokens: bigint;
        completion_tokens: bigint;
      }>
    >`
      SELECT
        count(*)::int AS requests,
        (count(*) FILTER (WHERE status_code >= 400))::int AS errors,
        (count(*) FILTER (WHERE feature = 'CHAT'))::int AS chat,
        (count(*) FILTER (WHERE feature = 'SEARCH'))::int AS search,
        coalesce(sum(prompt_tokens), 0)::bigint AS prompt_tokens,
        coalesce(sum(completion_tokens), 0)::bigint AS completion_tokens
      FROM api_usage_logs
      WHERE created_at >= ${startOfToday}`;
    const requestsLast7Days = await this.prisma.apiUsageLog.count({
      where: { createdAt: { gte: since7Days } },
    });
    return {
      requestsToday: today?.requests ?? 0,
      errorsToday: today?.errors ?? 0,
      chatRequestsToday: today?.chat ?? 0,
      searchRequestsToday: today?.search ?? 0,
      promptTokensToday: Number(today?.prompt_tokens ?? 0),
      completionTokensToday: Number(today?.completion_tokens ?? 0),
      requestsLast7Days,
    };
  }

  async contentStats(): Promise<ContentStats> {
    const [conversations, messages, searches] = await Promise.all([
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.webSearch.count(),
    ]);
    return { conversations, messages, searches };
  }
}
