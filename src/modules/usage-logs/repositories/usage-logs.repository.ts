import { Injectable } from '@nestjs/common';

import { type UsageFeature } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

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

@Injectable()
export class UsageLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUsageLogData): Promise<void> {
    await this.prisma.apiUsageLog.create({ data });
  }
}
