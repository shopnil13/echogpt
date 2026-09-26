import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';

import {
  CONSUMES_QUOTA_KEY,
  type RequestWithQuota,
} from '../../../common/decorators/quota.decorators';
import { AppException } from '../../../common/errors/app.exception';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { QuotaService } from '../services/quota.service';

export const QUOTA_LIMIT_HEADER = 'X-Quota-Limit';
export const QUOTA_REMAINING_HEADER = 'X-Quota-Remaining';

/** Runs last among the global guards, so throttled or unauthorized requests never consume quota. */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly quotaService: QuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const consumes = this.reflector.get<boolean | undefined>(
      CONSUMES_QUOTA_KEY,
      context.getHandler(),
    );
    if (!consumes) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithQuota & { user?: AuthenticatedUser }>();
    if (!request.user) throw AppException.unauthorized();

    const reservation = await this.quotaService.consume(request.user.id);
    request.quotaReservation = reservation;
    http
      .getResponse<Response>()
      .setHeader(QUOTA_LIMIT_HEADER, String(reservation.limit))
      .setHeader(QUOTA_REMAINING_HEADER, String(Math.max(reservation.limit - reservation.used, 0)));
    return true;
  }
}
