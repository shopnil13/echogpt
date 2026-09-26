import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RoleName } from '../../../common/constants/roles.constants';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { Roles } from '../../../common/decorators/auth.decorators';
import { type Paginated } from '../../../common/dto/pagination.dto';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import {
  AdminSubscriptionResponseDto,
  AdminPlanResponseDto,
} from '../dto/admin/admin-subscription.response.dto';
import { AdminSubscriptionsQueryDto } from '../dto/admin/admin-subscriptions.query.dto';
import { UpdatePlanDto } from '../dto/admin/update-plan.dto';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { SubscriptionResponseDto } from '../dto/responses/subscription.response.dto';
import {
  toAdminPlanResponse,
  toAdminSubscriptionResponse,
  toSubscriptionResponse,
} from '../mappers/subscription.mapper';
import { PlansService } from '../services/plans.service';
import { SubscriptionsService } from '../services/subscriptions.service';

const PLAN_NOT_FOUND = {
  status: HttpStatus.NOT_FOUND,
  code: ErrorCode.PLAN_NOT_FOUND,
  message: 'Plan not found',
};

@ApiTags('Admin · Subscriptions')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Roles(RoleName.ADMIN)
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('admin')
export class AdminSubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
  ) {}

  @Get('subscriptions')
  @ApiOperation({
    summary: 'List subscriptions',
    description: 'Filter by plan code and status. Newest first.',
  })
  @ApiPaginatedResponse(AdminSubscriptionResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  async list(
    @Query() query: AdminSubscriptionsQueryDto,
  ): Promise<Paginated<AdminSubscriptionResponseDto>> {
    const page = await this.subscriptionsService.listForAdmin(query);
    return { data: page.data.map(toAdminSubscriptionResponse), meta: page.meta };
  }

  @Put('users/:id/subscription')
  @ApiOperation({
    summary: 'Assign a plan to a user',
    description:
      'Same semantics as a self-service plan change: the active subscription is cancelled and a new one starts.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
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
  async assignPlan(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: ChangePlanDto,
  ): Promise<SubscriptionResponseDto> {
    return toSubscriptionResponse(await this.subscriptionsService.changePlan(userId, dto.planCode));
  }

  @Get('plans')
  @ApiOperation({ summary: 'List all plans, including inactive ones' })
  @ApiOkResponse({ type: AdminPlanResponseDto, isArray: true })
  async listPlans(): Promise<AdminPlanResponseDto[]> {
    return (await this.plansService.listAll()).map(toAdminPlanResponse);
  }

  @Patch('plans/:id')
  @ApiOperation({
    summary: 'Edit a plan',
    description: 'Changing limits applies immediately to every subscriber of the plan.',
  })
  @ApiOkResponse({ type: AdminPlanResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, PLAN_NOT_FOUND, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.PLAN_IS_DEFAULT,
    message: 'The default plan for new accounts cannot be deactivated',
  })
  async updatePlan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<AdminPlanResponseDto> {
    return toAdminPlanResponse(await this.plansService.update(id, dto));
  }
}
