import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RoleName } from '../../../common/constants/roles.constants';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { Roles } from '../../../common/decorators/auth.decorators';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { DashboardStatsResponseDto } from '../dto/dashboard-stats.response.dto';
import { SystemHealthResponseDto } from '../dto/system-health.response.dto';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@ApiTags('Admin · Dashboard')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Roles(RoleName.ADMIN)
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Dashboard statistics',
    description:
      "Users, active subscriptions per plan, today's usage (UTC), content volume and provider health.",
  })
  @ApiOkResponse({ type: DashboardStatsResponseDto })
  stats(): Promise<DashboardStatsResponseDto> {
    return this.dashboardService.stats();
  }

  @Get('system/health')
  @ApiOperation({
    summary: 'System health',
    description:
      'Database status and latency, runtime metrics, version and last known provider health.',
  })
  @ApiOkResponse({ type: SystemHealthResponseDto })
  systemHealth(): Promise<SystemHealthResponseDto> {
    return this.dashboardService.systemHealth();
  }
}
