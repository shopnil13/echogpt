import { ApiProperty } from '@nestjs/swagger';

class DashboardUsersDto {
  @ApiProperty({ example: 1280 }) total: number;
  @ApiProperty({ example: 1264 }) active: number;
  @ApiProperty({ example: 16 }) suspended: number;
  @ApiProperty({ example: 1102 }) verified: number;
  @ApiProperty({ example: 87 }) newLast7Days: number;
}

class PlanCountDto {
  @ApiProperty({ example: 'premium' }) planCode: string;
  @ApiProperty({ example: 214 }) count: number;
}

class DashboardUsageDto {
  @ApiProperty({ example: 5310 }) requestsToday: number;
  @ApiProperty({ example: 42 }) errorsToday: number;
  @ApiProperty({ example: 2890 }) chatRequestsToday: number;
  @ApiProperty({ example: 611 }) searchRequestsToday: number;
  @ApiProperty({ example: 1840221 }) promptTokensToday: number;
  @ApiProperty({ example: 402119 }) completionTokensToday: number;
  @ApiProperty({ example: 33108 }) requestsLast7Days: number;
}

class DashboardContentDto {
  @ApiProperty({ example: 9021 }) conversations: number;
  @ApiProperty({ example: 88410 }) messages: number;
  @ApiProperty({ example: 12004 }) searches: number;
}

class DashboardProvidersDto {
  @ApiProperty({ example: 4 }) total: number;
  @ApiProperty({ example: 3 }) enabled: number;
  @ApiProperty({ example: 2 }) healthy: number;
  @ApiProperty({ example: 1 }) unhealthy: number;
  @ApiProperty({ nullable: true, type: String, example: 'Anthropic Claude' }) defaultProvider:
    string | null;
}

export class DashboardStatsResponseDto {
  @ApiProperty({ format: 'date-time' }) generatedAt: Date;
  @ApiProperty({ type: DashboardUsersDto }) users: DashboardUsersDto;
  @ApiProperty({ type: PlanCountDto, isArray: true }) activeSubscriptionsByPlan: PlanCountDto[];
  @ApiProperty({ type: DashboardUsageDto }) usage: DashboardUsageDto;
  @ApiProperty({ type: DashboardContentDto }) content: DashboardContentDto;
  @ApiProperty({ type: DashboardProvidersDto }) providers: DashboardProvidersDto;
}
