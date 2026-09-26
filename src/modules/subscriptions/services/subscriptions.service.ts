import { Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PLAN_CODE } from '../../../common/constants/plans.constants';
import { type Paginated, paginate } from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type AdminSubscriptionsQueryDto } from '../dto/admin/admin-subscriptions.query.dto';
import {
  type SubscriptionWithPlan,
  type SubscriptionWithUser,
  SubscriptionsRepository,
} from '../repositories/subscriptions.repository';
import { PlansService } from './plans.service';

/**
 * Subscription lifecycle. No payment provider is integrated (out of scope); a plan change is
 * applied immediately. A PaymentGateway would be called before `changePlan` commits.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly plansService: PlansService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns the active subscription. Every account gets one at registration; if it is missing
   * (manual data fix, legacy row) the user is self-healed onto the default plan.
   */
  async getActive(userId: string): Promise<SubscriptionWithPlan> {
    const active = await this.subscriptionsRepository.findActiveWithPlan(userId);
    if (active) return active;

    this.logger.warn({ userId }, 'User had no active subscription; assigning the default plan');
    const plan = await this.plansService.getActiveByCode(DEFAULT_PLAN_CODE);
    return this.prisma.$transaction((tx) =>
      this.subscriptionsRepository.create(userId, plan.id, new Date(), tx),
    );
  }

  async listForAdmin(query: AdminSubscriptionsQueryDto): Promise<Paginated<SubscriptionWithUser>> {
    const [items, total] = await this.subscriptionsRepository.listForAdmin({
      skip: query.skip,
      take: query.limit,
      planCode: query.planCode,
      status: query.status,
    });
    return paginate(items, total, query);
  }

  history(userId: string): Promise<SubscriptionWithPlan[]> {
    return this.subscriptionsRepository.listForUser(userId);
  }

  /**
   * Upgrades or downgrades by cancelling the active subscription and starting a new one, so the
   * history is preserved. The partial unique index guarantees one ACTIVE row even under races.
   */
  async changePlan(userId: string, planCode: string): Promise<SubscriptionWithPlan> {
    const plan = await this.plansService.getActiveByCode(planCode);
    const now = new Date();

    const subscription = await this.prisma.$transaction(async (tx) => {
      const current = await this.subscriptionsRepository.findActiveWithPlan(userId, tx);
      if (current?.planId === plan.id) {
        throw AppException.conflict(
          ErrorCode.PLAN_ALREADY_ACTIVE,
          `You are already on the ${plan.name} plan`,
        );
      }
      if (current) await this.subscriptionsRepository.cancel(current.id, now, tx);
      return this.subscriptionsRepository.create(userId, plan.id, now, tx);
    });

    this.logger.log({ userId, planCode }, 'Subscription plan changed');
    return subscription;
  }
}
