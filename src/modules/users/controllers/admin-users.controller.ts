import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RoleName } from '../../../common/constants/roles.constants';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { CurrentUser, Roles } from '../../../common/decorators/auth.decorators';
import { type Paginated } from '../../../common/dto/pagination.dto';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { toSubscriptionResponse } from '../../subscriptions/mappers/subscription.mapper';
import { QuotaService } from '../../subscriptions/services/quota.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { AdminUpdateUserDto } from '../dto/admin/admin-update-user.dto';
import { AdminUserDetailResponseDto } from '../dto/admin/admin-user-detail.response.dto';
import { AdminUsersQueryDto } from '../dto/admin/admin-users.query.dto';
import { UserProfileResponseDto } from '../dto/responses/user-profile.response.dto';
import { toUserProfileResponse } from '../mappers/user.mapper';
import { AdminUsersService } from '../services/admin-users.service';

const USER_NOT_FOUND = {
  status: HttpStatus.NOT_FOUND,
  code: ErrorCode.USER_NOT_FOUND,
  message: 'User not found',
};
const SELF_MODIFICATION = {
  status: HttpStatus.UNPROCESSABLE_ENTITY,
  code: ErrorCode.ADMIN_SELF_MODIFICATION,
  message: 'You cannot demote or suspend your own account',
};

@ApiTags('Admin · Users')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Roles(RoleName.ADMIN)
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly quotaService: QuotaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description: 'Filter by text, role and status. Newest first.',
  })
  @ApiPaginatedResponse(UserProfileResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  async list(@Query() query: AdminUsersQueryDto): Promise<Paginated<UserProfileResponseDto>> {
    const page = await this.adminUsersService.list(query);
    return { data: page.data.map(toUserProfileResponse), meta: page.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user with subscription, usage and session count' })
  @ApiOkResponse({ type: AdminUserDetailResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, USER_NOT_FOUND)
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserDetailResponseDto> {
    const user = await this.adminUsersService.get(id);
    const [subscription, usage, activeSessions] = await Promise.all([
      this.subscriptionsService.getActive(id),
      this.quotaService.getUsage(id),
      this.adminUsersService.countActiveSessions(id),
    ]);
    return {
      ...toUserProfileResponse(user),
      subscription: toSubscriptionResponse(subscription),
      usage,
      activeSessions,
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Change a user's role or status",
    description:
      'Suspending signs the user out of every session immediately. Admins cannot demote or suspend themselves.',
  })
  @ApiOkResponse({ type: UserProfileResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, USER_NOT_FOUND, SELF_MODIFICATION)
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserProfileResponseDto> {
    return toUserProfileResponse(await this.adminUsersService.update(actor, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Same effect as account deletion. Not allowed on yourself.',
  })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, USER_NOT_FOUND, {
    ...SELF_MODIFICATION,
    message: 'Use DELETE /users/me to delete your own account',
  })
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.adminUsersService.remove(actor, id);
  }
}
