import { Inject, Injectable } from '@nestjs/common';

import { appConfig, type AppConfig } from '../../../config/app.config';
import { ProviderHealthStatus } from '../../../generated/prisma/enums';
import { PrismaHealthIndicator } from '../../../infrastructure/prisma/prisma-health.indicator';
import { AiProvidersService } from '../../ai-providers/services/ai-providers.service';
import { quotaWindow } from '../../subscriptions/utils/quota-period';
import { type DashboardStatsResponseDto } from '../dto/dashboard-stats.response.dto';
import { type SystemHealthResponseDto } from '../dto/system-health.response.dto';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIB = 1024 * 1024;

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly statsRepository: AdminStatsRepository,
    private readonly providersService: AiProvidersService,
    private readonly databaseHealth: PrismaHealthIndicator,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  async stats(): Promise<DashboardStatsResponseDto> {
    const now = new Date();
    const startOfToday = quotaWindow('DAILY', now).start;
    const since7Days = new Date(now.getTime() - 7 * DAY_MS);

    const [users, activeSubscriptionsByPlan, usage, content, providers] = await Promise.all([
      this.statsRepository.userStats(since7Days),
      this.statsRepository.activeSubscriptionsByPlan(),
      this.statsRepository.usageStats(startOfToday, since7Days),
      this.statsRepository.contentStats(),
      this.providersService.listAll(),
    ]);

    return {
      generatedAt: now,
      users,
      activeSubscriptionsByPlan,
      usage,
      content,
      providers: {
        total: providers.length,
        enabled: providers.filter((provider) => provider.isEnabled).length,
        healthy: providers.filter(
          (provider) => provider.healthStatus === ProviderHealthStatus.HEALTHY,
        ).length,
        unhealthy: providers.filter(
          (provider) => provider.healthStatus === ProviderHealthStatus.UNHEALTHY,
        ).length,
        defaultProvider: providers.find((provider) => provider.isDefault)?.name ?? null,
      },
    };
  }

  /** Detailed health for operators; the public /health endpoints stay minimal. */
  async systemHealth(): Promise<SystemHealthResponseDto> {
    const [database, providers] = await Promise.all([
      this.databaseHealth.pingCheck('database'),
      this.providersService.listAll(),
    ]);
    const db = database.database as { status: 'up' | 'down'; latencyMs?: number } | undefined;
    const memory = process.memoryUsage();
    const databaseUp = db?.status === 'up';

    return {
      status: databaseUp ? 'ok' : 'degraded',
      checkedAt: new Date(),
      database: { status: databaseUp ? 'up' : 'down', latencyMs: db?.latencyMs ?? null },
      runtime: {
        node: process.version,
        environment: this.config.nodeEnv,
        version: this.config.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(memory.rss / MIB),
        heapUsedMb: Math.round(memory.heapUsed / MIB),
      },
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        isEnabled: provider.isEnabled,
        isDefault: provider.isDefault,
        healthStatus: provider.healthStatus,
        lastCheckedAt: provider.lastHealthCheckAt,
      })),
    };
  }
}
