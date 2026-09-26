import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import { type QuotaReservation } from '../types/quota-reservation';

export const CONSUMES_QUOTA_KEY = 'quota:consumes';

export type RequestWithQuota = Request & { quotaReservation?: QuotaReservation };

/** Marks a route as consuming one request from the caller's plan allowance (QuotaGuard). */
export const ConsumesQuota = (): MethodDecorator => SetMetadata(CONSUMES_QUOTA_KEY, true);

/** Injects the reservation made by QuotaGuard, so the handler can refund it on failure. */
export const Quota = createParamDecorator(
  (_data: unknown, context: ExecutionContext): QuotaReservation => {
    const reservation = context.switchToHttp().getRequest<RequestWithQuota>().quotaReservation;
    if (!reservation) {
      throw new Error('@Quota() used on a route without @ConsumesQuota()');
    }
    return reservation;
  },
);
