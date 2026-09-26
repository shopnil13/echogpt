import { Module } from '@nestjs/common';

import { AdminUsageController } from './controllers/admin-usage.controller';
import { UsageLogMiddleware } from './middleware/usage-log.middleware';
import { UsageLogsRepository } from './repositories/usage-logs.repository';
import { UsageAnalyticsService } from './services/usage-analytics.service';
import { UsageLogsService } from './services/usage-logs.service';

@Module({
  controllers: [AdminUsageController],
  providers: [UsageLogsRepository, UsageLogsService, UsageAnalyticsService, UsageLogMiddleware],
  exports: [UsageLogsService, UsageAnalyticsService, UsageLogMiddleware],
})
export class UsageLogsModule {}
