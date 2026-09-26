import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up({ latencyMs: Date.now() - startedAt });
    } catch {
      return indicator.down({ message: 'Database is unreachable' });
    }
  }
}
