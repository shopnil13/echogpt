import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { CurrentUser } from '../../../common/decorators/auth.decorators';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { DeleteAccountDto } from '../dto/delete-account.dto';
import { UserProfileResponseDto } from '../dto/responses/user-profile.response.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { toUserProfileResponse } from '../mappers/user.mapper';
import { AccountService } from '../services/account.service';

const PASSWORD_INCORRECT_ERROR = {
  status: HttpStatus.UNPROCESSABLE_ENTITY,
  code: ErrorCode.PASSWORD_INCORRECT,
  message: 'Password is incorrect',
};

@ApiTags('Users')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Controller('users/me')
export class MeController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Get your profile' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponseDto> {
    return toUserProfileResponse(await this.accountService.getProfile(user.id));
  }

  @Patch()
  @ApiOperation({ summary: 'Update your profile', description: 'Only the provided fields change.' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    return toUserProfileResponse(await this.accountService.updateProfile(user.id, dto));
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change your password',
    description:
      'Requires the current password. Every other session is signed out; this one stays active.',
  })
  @ApiNoContentResponse({ description: 'Password changed' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, PASSWORD_INCORRECT_ERROR, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.PASSWORD_UNCHANGED,
    message: 'New password must differ from the current one',
    description:
      'Wrong current password (PASSWORD_INCORRECT) or new password equals the old one (PASSWORD_UNCHANGED)',
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.accountService.changePassword(user, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete your account',
    description:
      'Permanently deletes the account, sessions, subscriptions, conversations and search history. ' +
      'Usage logs are kept for aggregate analytics without the user reference.',
  })
  @ApiNoContentResponse({ description: 'Account deleted' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, PASSWORD_INCORRECT_ERROR, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.LAST_ADMIN,
    message: 'The last administrator account cannot be deleted',
    description: 'Wrong password (PASSWORD_INCORRECT) or last remaining admin (LAST_ADMIN)',
  })
  deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.accountService.deleteAccount(user, dto.password);
  }
}
