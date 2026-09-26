import { Injectable } from '@nestjs/common';

import { type ApiUsageLog, Prisma, type UsageFeature } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type AnalyticsGranularity, type AnalyticsGroupBy } from '../dto/usage-analytics.query.dto';

export interface CreateUsageLogData {
  requestId: string;
  userId: string | null;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  feature: UsageFeature | null;
  providerId: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  errorCode: string | null;
}

export interface RequestLogFilter {
  skip: number;
  take: number;
  userId?: string;
  statusCode?: number;
  method?: string;
  route?: string;
  feature?: UsageFeature;
  from?: Date;
  to?: Date;
}

export interface UsageAggregateRow {
  bucket: Date;
  key: string;
  requests: number;
  errors: number;
  promptTokens: bigint | number;
  completionTokens: bigint | number;
  avgDurationMs: number;
}

/**
 * Group-by expressions come from this fixed map, never from user input, so the dynamic part of
 * the analytics query is still fully parameterized SQL.
 */
const GROUP_EXPRESSIONS: Record<AnalyticsGroupBy, Prisma.Sql> = {
  none: Prisma.sql`'all'`,
  feature: Prisma.sql`coalesce(l.feature::text, 'OTHER')`,
  provider: Prisma.sql`coalesce(p.name, 'none')`,
  status: Prisma.sql`((l.status_code / 100)::text || 'xx')`,
  route: Prisma.sql`l.route`,
};

@Injectable()
export class UsageLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUsageLogData): Promise<void> {
    await this.prisma.apiUsageLog.create({ data });
  }

  async list(filter: RequestLogFilter): Promise<[ApiUsageLog[], number]> {
    const where: Prisma.ApiUsageLogWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.statusCode ? { statusCode: filter.statusCode } : {}),
      ...(filter.method ? { method: filter.method } : {}),
      ...(filter.route ? { route: { contains: filter.route } } : {}),
      ...(filter.feature ? { feature: filter.feature } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lt: filter.to } : {}),
            },
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.apiUsageLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.apiUsageLog.count({ where }),
    ]);
  }

  aggregate(
    from: Date,
    to: Date,
    granularity: AnalyticsGranularity,
    groupBy: AnalyticsGroupBy,
  ): Promise<UsageAggregateRow[]> {
    const groupExpression = GROUP_EXPRESSIONS[groupBy];
    return this.prisma.$queryRaw<UsageAggregateRow[]>`
      SELECT
        date_trunc(${granularity}, l.created_at) AS bucket,
        ${groupExpression} AS key,
        count(*)::int AS requests,
        (count(*) FILTER (WHERE l.status_code >= 400))::int AS errors,
        coalesce(sum(l.prompt_tokens), 0)::bigint AS "promptTokens",
        coalesce(sum(l.completion_tokens), 0)::bigint AS "completionTokens",
        coalesce(round(avg(l.duration_ms)), 0)::int AS "avgDurationMs"
      FROM api_usage_logs l
      LEFT JOIN ai_providers p ON p.id = l.provider_id
      WHERE l.created_at >= ${from} AND l.created_at < ${to}
      GROUP BY 1, 2
      ORDER BY 1, 2`;
  }
}
