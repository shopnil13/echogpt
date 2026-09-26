import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';

export const ANALYTICS_GRANULARITIES = ['hour', 'day', 'week', 'month'] as const;
export const ANALYTICS_GROUPINGS = ['none', 'feature', 'provider', 'status', 'route'] as const;

export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];
export type AnalyticsGroupBy = (typeof ANALYTICS_GROUPINGS)[number];

export class UsageAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive start (default: 7 days ago)',
    example: '2026-09-20T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'Exclusive end (default: now). Range at most 366 days.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ enum: ANALYTICS_GRANULARITIES, default: 'day' })
  @IsOptional()
  @IsIn(ANALYTICS_GRANULARITIES)
  granularity: AnalyticsGranularity = 'day';

  @ApiPropertyOptional({ enum: ANALYTICS_GROUPINGS, default: 'none' })
  @IsOptional()
  @IsIn(ANALYTICS_GROUPINGS)
  groupBy: AnalyticsGroupBy = 'none';
}
