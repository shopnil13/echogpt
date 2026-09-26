import { Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type Plan } from '../../../generated/prisma/client';
import { PlansRepository } from '../repositories/plans.repository';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: PlansRepository) {}

  listActive(): Promise<Plan[]> {
    return this.plansRepository.listActive();
  }

  listAll(): Promise<Plan[]> {
    return this.plansRepository.listAll();
  }

  /** Resolves a plan that users may subscribe to (inactive plans are hidden). */
  async getActiveByCode(code: string): Promise<Plan> {
    const plan = await this.plansRepository.findByCode(code);
    if (!plan?.isActive)
      throw AppException.notFound(ErrorCode.PLAN_NOT_FOUND, `Plan "${code}" does not exist`);
    return plan;
  }
}
