import { Injectable, Logger } from '@nestjs/common';

import {
  type CreateUsageLogData,
  UsageLogsRepository,
} from '../repositories/usage-logs.repository';

@Injectable()
export class UsageLogsService {
  private readonly logger = new Logger(UsageLogsService.name);

  constructor(private readonly usageLogsRepository: UsageLogsRepository) {}

  /**
   * Fire-and-forget: logging must never slow down or fail the request it describes.
   * Failures are reported to the application log instead.
   */
  record(entry: CreateUsageLogData): void {
    this.usageLogsRepository.create(entry).catch((error: unknown) => {
      this.logger.error({ err: error, requestId: entry.requestId }, 'Failed to write usage log');
    });
  }
}
