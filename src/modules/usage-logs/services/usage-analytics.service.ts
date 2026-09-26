import { Injectable } from '@nestjs/common';

import { type Paginated, paginate } from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type ApiUsageLog } from '../../../generated/prisma/client';
import { type RequestLogsQueryDto } from '../dto/request-logs.query.dto';
import {
  type UsageAnalyticsResponseDto,
  type UsageTotalsDto,
} from '../dto/responses/usage-analytics.response.dto';
import { type UsageAnalyticsQueryDto } from '../dto/usage-analytics.query.dto';
import { UsageLogsRepository } from '../repositories/usage-logs.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 7 * DAY_MS;
const MAX_RANGE_MS = 366 * DAY_MS;

@Injectable()
export class UsageAnalyticsService {
  constructor(private readonly repository: UsageLogsRepository) {}

  async requestLogs(query: RequestLogsQueryDto): Promise<Paginated<ApiUsageLog>> {
    if (query.from && query.to) assertRange(query.from, query.to, Number.POSITIVE_INFINITY);
    const [items, total] = await this.repository.list({
      skip: query.skip,
      take: query.limit,
      userId: query.userId,
      statusCode: query.statusCode,
      method: query.method,
      route: query.route,
      feature: query.feature,
      from: query.from,
      to: query.to,
    });
    return paginate(items, total, query);
  }

  async usage(query: UsageAnalyticsQueryDto): Promise<UsageAnalyticsResponseDto> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_MS);
    assertRange(from, to, MAX_RANGE_MS);

    const rows = await this.repository.aggregate(from, to, query.granularity, query.groupBy);
    const series = rows.map((row) => ({
      bucket: row.bucket,
      key: row.key,
      requests: row.requests,
      errors: row.errors,
      promptTokens: Number(row.promptTokens),
      completionTokens: Number(row.completionTokens),
      avgDurationMs: row.avgDurationMs,
    }));
    return {
      from,
      to,
      granularity: query.granularity,
      groupBy: query.groupBy,
      totals: totalsOf(series),
      series,
    };
  }
}

function assertRange(from: Date, to: Date, maxMs: number): void {
  if (from >= to) {
    throw AppException.unprocessable(
      ErrorCode.INVALID_DATE_RANGE,
      '`from` must be earlier than `to`',
    );
  }
  if (to.getTime() - from.getTime() > maxMs) {
    throw AppException.unprocessable(
      ErrorCode.INVALID_DATE_RANGE,
      'The date range may span at most 366 days',
    );
  }
}

/** Duration is averaged by request count, not by bucket, so busy buckets weigh more. */
function totalsOf(series: UsageTotalsDto[]): UsageTotalsDto {
  const totals = series.reduce(
    (sum, point) => ({
      requests: sum.requests + point.requests,
      errors: sum.errors + point.errors,
      promptTokens: sum.promptTokens + point.promptTokens,
      completionTokens: sum.completionTokens + point.completionTokens,
      weightedDuration: sum.weightedDuration + point.avgDurationMs * point.requests,
    }),
    { requests: 0, errors: 0, promptTokens: 0, completionTokens: 0, weightedDuration: 0 },
  );
  const { weightedDuration, ...rest } = totals;
  return {
    ...rest,
    avgDurationMs: totals.requests ? Math.round(weightedDuration / totals.requests) : 0,
  };
}
