import { Injectable } from '@nestjs/common';

import { type Prisma, SubscriptionStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type DbClient } from '../../../infrastructure/prisma/prisma.types';

export const subscriptionWithPlanInclude = { plan: true } satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionWithPlanInclude;
}>;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveWithPlan(
    userId: string,
    db: DbClient = this.prisma,
  ): Promise<SubscriptionWithPlan | null> {
    return db.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: subscriptionWithPlanInclude,
    });
  }

  listForUser(userId: string): Promise<SubscriptionWithPlan[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: subscriptionWithPlanInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancel(id: string, at: Date, db: DbClient): Promise<void> {
    await db.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: at, currentPeriodEnd: at },
    });
  }

  create(userId: string, planId: string, at: Date, db: DbClient): Promise<SubscriptionWithPlan> {
    return db.subscription.create({
      data: { userId, planId, status: SubscriptionStatus.ACTIVE, currentPeriodStart: at },
      include: subscriptionWithPlanInclude,
    });
  }
}
