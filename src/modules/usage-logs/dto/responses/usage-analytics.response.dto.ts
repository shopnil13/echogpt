import { ApiProperty } from '@nestjs/swagger';

import { ANALYTICS_GRANULARITIES, ANALYTICS_GROUPINGS } from '../usage-analytics.query.dto';

export class UsageTotalsDto {
  @ApiProperty({ example: 1840 })
  requests: number;

  @ApiProperty({ example: 37, description: 'Responses with status >= 400' })
  errors: number;

  @ApiProperty({ example: 210332 })
  promptTokens: number;

  @ApiProperty({ example: 58210 })
  completionTokens: number;

  @ApiProperty({ example: 412 })
  avgDurationMs: number;
}

export class UsageSeriesPointDto extends UsageTotalsDto {
  @ApiProperty({ format: 'date-time', description: 'Start of the bucket (UTC)' })
  bucket: Date;

  @ApiProperty({ example: 'CHAT', description: "Group value ('all' when groupBy=none)" })
  key: string;
}

export class UsageAnalyticsResponseDto {
  @ApiProperty({ format: 'date-time' })
  from: Date;

  @ApiProperty({ format: 'date-time' })
  to: Date;

  @ApiProperty({ enum: ANALYTICS_GRANULARITIES })
  granularity: string;

  @ApiProperty({ enum: ANALYTICS_GROUPINGS })
  groupBy: string;

  @ApiProperty({ type: UsageTotalsDto })
  totals: UsageTotalsDto;

  @ApiProperty({ type: UsageSeriesPointDto, isArray: true })
  series: UsageSeriesPointDto[];
}
