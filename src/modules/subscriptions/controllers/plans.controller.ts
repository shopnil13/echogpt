import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { Public } from '../../../common/decorators/auth.decorators';
import { PlanResponseDto } from '../dto/responses/plan.response.dto';
import { toPlanResponse } from '../mappers/subscription.mapper';
import { PlansService } from '../services/plans.service';

@ApiTags('Subscriptions')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List available plans',
    description: 'Public. Prices and request limits of active plans.',
  })
  @ApiOkResponse({ type: PlanResponseDto, isArray: true })
  @ApiErrorResponses(HttpStatus.TOO_MANY_REQUESTS)
  async list(): Promise<PlanResponseDto[]> {
    const plans = await this.plansService.listActive();
    return plans.map(toPlanResponse);
  }
}
