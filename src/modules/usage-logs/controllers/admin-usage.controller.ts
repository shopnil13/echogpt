import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RoleName } from '../../../common/constants/roles.constants';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { Roles } from '../../../common/decorators/auth.decorators';
import { type Paginated } from '../../../common/dto/pagination.dto';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { RequestLogsQueryDto } from '../dto/request-logs.query.dto';
import { RequestLogResponseDto } from '../dto/responses/request-log.response.dto';
import { UsageAnalyticsResponseDto } from '../dto/responses/usage-analytics.response.dto';
import { UsageAnalyticsQueryDto } from '../dto/usage-analytics.query.dto';
import { toRequestLogResponse } from '../mappers/request-log.mapper';
import { UsageAnalyticsService } from '../services/usage-analytics.service';

const INVALID_RANGE = {
  status: HttpStatus.UNPROCESSABLE_ENTITY,
  code: ErrorCode.INVALID_DATE_RANGE,
  message: '`from` must be earlier than `to`',
};

@ApiTags('Admin · Usage')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Roles(RoleName.ADMIN)
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('admin')
export class AdminUsageController {
  constructor(private readonly analyticsService: UsageAnalyticsService) {}

  @Get('logs/requests')
  @ApiOperation({
    summary: 'Browse API request logs',
    description:
      'One row per API request (health and docs excluded). Newest first. Filter by user, status, method, route, feature and time.',
  })
  @ApiPaginatedResponse(RequestLogResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, INVALID_RANGE)
  async requestLogs(
    @Query() query: RequestLogsQueryDto,
  ): Promise<Paginated<RequestLogResponseDto>> {
    const page = await this.analyticsService.requestLogs(query);
    return { data: page.data.map(toRequestLogResponse), meta: page.meta };
  }

  @Get('analytics/usage')
  @ApiOperation({
    summary: 'API usage analytics',
    description:
      'Requests, errors, token usage and average latency per time bucket, optionally split by feature, provider, ' +
      'status class or route. Defaults to the last 7 days by day.',
  })
  @ApiOkResponse({ type: UsageAnalyticsResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, INVALID_RANGE)
  usage(@Query() query: UsageAnalyticsQueryDto): Promise<UsageAnalyticsResponseDto> {
    return this.analyticsService.usage(query);
  }
}
