import { Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PLAN_CODE } from '../../../common/constants/plans.constants';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type Plan } from '../../../generated/prisma/client';
import { type UpdatePlanDto } from '../dto/admin/update-plan.dto';
import { PlansRepository } from '../repositories/plans.repository';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly plansRepository: PlansRepository) {}

  listActive(): Promise<Plan[]> {
    return this.plansRepository.listActive();
  }

  listAll(): Promise<Plan[]> {
    return this.plansRepository.listAll();
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) throw AppException.notFound(ErrorCode.PLAN_NOT_FOUND, 'Plan not found');
    if (dto.isActive === false && plan.code === String(DEFAULT_PLAN_CODE)) {
      throw AppException.unprocessable(
        ErrorCode.PLAN_IS_DEFAULT,
        'The default plan for new accounts cannot be deactivated',
      );
    }
    const updated = await this.plansRepository.update(id, dto);
    this.logger.log({ planId: id, changes: dto }, 'Plan updated');
    return updated;
  }

  /** Resolves a plan that users may subscribe to (inactive plans are hidden). */
  async getActiveByCode(code: string): Promise<Plan> {
    const plan = await this.plansRepository.findByCode(code);
    if (!plan?.isActive)
      throw AppException.notFound(ErrorCode.PLAN_NOT_FOUND, `Plan "${code}" does not exist`);
    return plan;
  }
}
