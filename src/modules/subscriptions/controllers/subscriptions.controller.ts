import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { CurrentUser } from '../../../common/decorators/auth.decorators';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { SubscriptionResponseDto } from '../dto/responses/subscription.response.dto';
import { UsageResponseDto } from '../dto/responses/usage.response.dto';
import { toSubscriptionResponse } from '../mappers/subscription.mapper';
import { QuotaService } from '../services/quota.service';
import { SubscriptionsService } from '../services/subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Controller('subscriptions/me')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly quotaService: QuotaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get your subscription status',
    description: 'Active plan, status and period.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionResponseDto> {
    return toSubscriptionResponse(await this.subscriptionsService.getActive(user.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Upgrade or downgrade your plan',
    description:
      'Switches to another active plan immediately. The previous subscription is kept as CANCELED history. ' +
      'Usage already counted in the current period carries over; the new limit applies at once.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    {
      status: HttpStatus.NOT_FOUND,
      code: ErrorCode.PLAN_NOT_FOUND,
      message: 'Plan "gold" does not exist',
    },
    {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.PLAN_ALREADY_ACTIVE,
      message: 'You are already on the Premium plan',
    },
  )
  async changePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
  ): Promise<SubscriptionResponseDto> {
    return toSubscriptionResponse(
      await this.subscriptionsService.changePlan(user.id, dto.planCode),
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'List your subscription history', description: 'Newest first.' })
  @ApiOkResponse({ type: SubscriptionResponseDto, isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async history(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionResponseDto[]> {
    const subscriptions = await this.subscriptionsService.history(user.id);
    return subscriptions.map(toSubscriptionResponse);
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get remaining requests',
    description: 'Usage of the plan allowance in the current UTC day or month, and when it resets.',
  })
  @ApiOkResponse({ type: UsageResponseDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  getUsage(@CurrentUser() user: AuthenticatedUser): Promise<UsageResponseDto> {
    return this.quotaService.getUsage(user.id);
  }
}
