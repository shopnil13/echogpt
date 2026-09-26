import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type QuotaReservation } from '../../../common/types/quota-reservation';
import { type LimitPeriod } from '../../../generated/prisma/enums';
import { UsageCountersRepository } from '../repositories/usage-counters.repository';
import { quotaWindow, secondsUntil } from '../utils/quota-period';
import { SubscriptionsService } from './subscriptions.service';

export interface QuotaUsage {
  planCode: string;
  period: LimitPeriod;
  limit: number;
  used: number;
  remaining: number;
  periodStart: Date;
  resetsAt: Date;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usageCountersRepository: UsageCountersRepository,
  ) {}

  async getUsage(userId: string): Promise<QuotaUsage> {
    const { plan } = await this.subscriptionsService.getActive(userId);
    const window = quotaWindow(plan.limitPeriod);
    const used = await this.usageCountersRepository.getCount(userId, window.start);
    return {
      planCode: plan.code,
      period: plan.limitPeriod,
      limit: plan.requestLimit,
      used,
      remaining: Math.max(plan.requestLimit - used, 0),
      periodStart: window.start,
      resetsAt: window.end,
    };
  }

  /** Consumes one request from the user's allowance or throws 429 QUOTA_EXCEEDED. */
  async consume(userId: string): Promise<QuotaReservation> {
    const { plan } = await this.subscriptionsService.getActive(userId);
    const window = quotaWindow(plan.limitPeriod);

    const used =
      plan.requestLimit > 0
        ? await this.usageCountersRepository.incrementIfBelow(
            userId,
            window.start,
            plan.limitPeriod,
            plan.requestLimit,
          )
        : null;

    if (used === null) {
      this.logger.warn({ userId, planCode: plan.code, limit: plan.requestLimit }, 'Quota exceeded');
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.QUOTA_EXCEEDED,
        `You have used all ${plan.requestLimit} requests of your ${plan.name} plan for this period`,
        {
          details: {
            limit: plan.requestLimit,
            period: plan.limitPeriod,
            resetsAt: window.end.toISOString(),
          },
          headers: { 'Retry-After': String(secondsUntil(window.end)) },
        },
      );
    }

    return {
      userId,
      periodStart: window.start,
      limit: plan.requestLimit,
      used,
      resetsAt: window.end,
    };
  }

  /** Returns a consumed unit. Failures are logged, never thrown: a refund must not mask the original error. */
  async refund(reservation: QuotaReservation): Promise<void> {
    try {
      await this.usageCountersRepository.decrement(reservation.userId, reservation.periodStart);
    } catch (error: unknown) {
      this.logger.error({ err: error, userId: reservation.userId }, 'Failed to refund quota');
    }
  }
}
