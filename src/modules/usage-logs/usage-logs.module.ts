import { Module } from '@nestjs/common';

import { UsageLogMiddleware } from './middleware/usage-log.middleware';
import { UsageLogsRepository } from './repositories/usage-logs.repository';
import { UsageLogsService } from './services/usage-logs.service';

@Module({
  providers: [UsageLogsRepository, UsageLogsService, UsageLogMiddleware],
  exports: [UsageLogsService, UsageLogMiddleware],
})
export class UsageLogsModule {}
