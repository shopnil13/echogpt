import { Module } from '@nestjs/common';

import { AdminSubscriptionsController } from './controllers/admin-subscriptions.controller';
import { PlansController } from './controllers/plans.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { QuotaGuard } from './guards/quota.guard';
import { PlansRepository } from './repositories/plans.repository';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';
import { UsageCountersRepository } from './repositories/usage-counters.repository';
import { PlansService } from './services/plans.service';
import { QuotaService } from './services/quota.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  controllers: [PlansController, SubscriptionsController, AdminSubscriptionsController],
  providers: [
    PlansRepository,
    SubscriptionsRepository,
    UsageCountersRepository,
    PlansService,
    SubscriptionsService,
    QuotaService,
    QuotaGuard,
  ],
  exports: [PlansService, SubscriptionsService, QuotaService, QuotaGuard],
})
export class SubscriptionsModule {}
