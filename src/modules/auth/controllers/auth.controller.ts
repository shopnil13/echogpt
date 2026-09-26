import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import {
  AuthThrottle,
  Client,
  CurrentUser,
  Public,
} from '../../../common/decorators/auth.decorators';
import { MessageResponseDto } from '../../../common/dto/message.response.dto';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { type ClientInfo } from '../../../common/types/client-info';
import { SessionRevokeReason } from '../../../generated/prisma/enums';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthTokensResponseDto } from '../dto/responses/auth-tokens.response.dto';
import { AuthResponseDto } from '../dto/responses/auth.response.dto';
import { SessionResponseDto } from '../dto/responses/session.response.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { toAuthResponse, toSessionResponse } from '../mappers/auth.mapper';
import { AuthService } from '../services/auth.service';
import { EmailVerificationService } from '../services/email-verification.service';
import { SessionService } from '../../sessions/services/session.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('register')
  @Public()
  @AuthThrottle()
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates a USER account on the Free plan, signs it in and sends a verification email.',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.EMAIL_ALREADY_REGISTERED,
      message: 'An account with this email already exists',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async register(@Body() dto: RegisterDto, @Client() client: ClientInfo): Promise<AuthResponseDto> {
    return toAuthResponse(await this.authService.register(dto, client));
  }

  @Post('login')
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description: 'Starts a new session (one per device).',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    {
      status: HttpStatus.UNAUTHORIZED,
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    },
    {
      status: HttpStatus.FORBIDDEN,
      code: ErrorCode.AUTH_ACCOUNT_SUSPENDED,
      message: 'Account is suspended',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async login(@Body() dto: LoginDto, @Client() client: ClientInfo): Promise<AuthResponseDto> {
    return toAuthResponse(await this.authService.login(dto, client));
  }

  @Post('refresh')
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token',
    description:
      'Returns a new access token and a new refresh token. The old refresh token stops working; ' +
      'presenting it again revokes the session (reuse detection).',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    {
      status: HttpStatus.UNAUTHORIZED,
      code: ErrorCode.AUTH_REFRESH_TOKEN_REUSED,
      message: 'Refresh token was already used; the session has been revoked',
      description:
        'Invalid, expired, revoked (AUTH_REFRESH_TOKEN_INVALID) or replayed (AUTH_REFRESH_TOKEN_REUSED) token',
    },
    {
      status: HttpStatus.FORBIDDEN,
      code: ErrorCode.AUTH_ACCOUNT_SUSPENDED,
      message: 'Account is suspended',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY)
  @ApiOperation({
    summary: 'Sign out of the current session',
    description: 'The access token stops working immediately.',
  })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(user);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY)
  @ApiOperation({ summary: 'Sign out of every session on every device' })
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logoutAll(user);
  }

  @Post('verify-email')
  @Public()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an email address',
    description: 'Consumes the single-use token from the email.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponses({
    status: HttpStatus.BAD_REQUEST,
    code: ErrorCode.AUTH_VERIFICATION_TOKEN_INVALID,
    message: 'Verification token is invalid, expired or already used',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    await this.emailVerificationService.verify(dto.token);
    return { message: 'Email address verified' };
  }

  @Post('resend-verification')
  @AuthThrottle()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY)
  @ApiOperation({
    summary: 'Send a new verification email',
    description: 'Earlier links stop working.',
  })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.EMAIL_ALREADY_VERIFIED,
      message: 'Email address is already verified',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.emailVerificationService.resend(user.id);
    return { message: 'Verification email sent' };
  }

  @Get('sessions')
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY)
  @ApiOperation({ summary: 'List active sessions (signed-in devices)' })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async listSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionService.listActive(user.id);
    return sessions.map((session) => toSessionResponse(session, user.sessionId));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY)
  @ApiOperation({ summary: 'Revoke one of your sessions (sign a device out)' })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, {
    status: HttpStatus.NOT_FOUND,
    code: ErrorCode.SESSION_NOT_FOUND,
    message: 'Session not found',
  })
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<void> {
    return this.sessionService.revoke(sessionId, user.id, SessionRevokeReason.LOGOUT);
  }
}
