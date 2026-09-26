import { Module } from '@nestjs/common';

import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminStatsRepository } from './repositories/admin-stats.repository';
import { AdminDashboardService } from './services/admin-dashboard.service';

/**
 * Cross-cutting admin views. Domain administration (users, subscriptions, providers, logs)
 * lives in each domain module under /admin/*; this module only aggregates.
 */
@Module({
  imports: [AiProvidersModule],
  controllers: [AdminDashboardController],
  providers: [AdminStatsRepository, AdminDashboardService],
})
export class AdminModule {}
