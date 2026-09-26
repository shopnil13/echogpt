import { type Plan } from '../../../generated/prisma/client';
import {
  type AdminPlanResponseDto,
  type AdminSubscriptionResponseDto,
} from '../dto/admin/admin-subscription.response.dto';
import { type PlanResponseDto } from '../dto/responses/plan.response.dto';
import { type SubscriptionResponseDto } from '../dto/responses/subscription.response.dto';
import {
  type SubscriptionWithPlan,
  type SubscriptionWithUser,
} from '../repositories/subscriptions.repository';

export function toPlanResponse(plan: Plan): PlanResponseDto {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    requestLimit: plan.requestLimit,
    limitPeriod: plan.limitPeriod,
  };
}

export function toSubscriptionResponse(
  subscription: SubscriptionWithPlan,
): SubscriptionResponseDto {
  return {
    id: subscription.id,
    status: subscription.status,
    plan: toPlanResponse(subscription.plan),
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    canceledAt: subscription.canceledAt,
    createdAt: subscription.createdAt,
  };
}

export function toAdminPlanResponse(plan: Plan): AdminPlanResponseDto {
  return {
    ...toPlanResponse(plan),
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function toAdminSubscriptionResponse(
  subscription: SubscriptionWithUser,
): AdminSubscriptionResponseDto {
  return { ...toSubscriptionResponse(subscription), user: subscription.user };
}
