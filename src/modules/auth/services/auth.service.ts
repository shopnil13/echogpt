import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { type RoleName } from '../../../common/constants/roles.constants';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { type ClientInfo } from '../../../common/types/client-info';
import { SessionRevokeReason, UserStatus } from '../../../generated/prisma/enums';
import { isUniqueViolation } from '../../../infrastructure/prisma/prisma-error.mapper';
import { generateOpaqueToken } from '../../../infrastructure/security/opaque-tokens';
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from '../../../infrastructure/security/password-hashing';
import { type UserProfileRecord } from '../../users/repositories/users.repository';
import { UsersService } from '../../users/services/users.service';
import { type LoginDto } from '../dto/login.dto';
import { type RegisterDto } from '../dto/register.dto';
import { type AuthTokensResponseDto } from '../dto/responses/auth-tokens.response.dto';
import { EmailVerificationService } from './email-verification.service';
import { type IssuedSession, SessionService } from './session.service';
import { TokenService } from './token.service';

export interface AuthResult {
  user: UserProfileRecord;
  tokens: AuthTokensResponseDto;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the email is unknown, so both failure paths take the same time. */
  private dummyPasswordHash = '';

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await hashPassword(generateOpaqueToken());
  }

  async register(dto: RegisterDto, client: ClientInfo): Promise<AuthResult> {
    if (await this.usersService.emailExists(dto.email)) {
      throw this.emailTaken();
    }

    const user = await this.usersService
      .createAccount({
        email: dto.email,
        passwordHash: await hashPassword(dto.password),
        fullName: dto.fullName,
      })
      .catch((error: unknown) => {
        // A concurrent registration with the same email won the race.
        if (isUniqueViolation(error)) throw this.emailTaken();
        throw error;
      });
    this.logger.log({ userId: user.id }, 'User registered');

    await this.emailVerificationService.sendSafely(user);
    const session = await this.sessionService.create(user.id, client);
    return { user, tokens: await this.buildTokens(user.id, user.role.name as RoleName, session) };
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthResult> {
    const credentials = await this.usersService.findCredentialsByEmail(dto.email);
    const passwordValid = await verifyPassword(
      credentials?.passwordHash ?? this.dummyPasswordHash,
      dto.password,
    );
    if (!credentials || !passwordValid) {
      throw AppException.unauthorized(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid email or password',
      );
    }
    // Checked after the password so the response does not reveal which accounts exist.
    if (credentials.status !== UserStatus.ACTIVE) {
      throw AppException.forbidden(ErrorCode.AUTH_ACCOUNT_SUSPENDED, 'Account is suspended');
    }

    if (passwordNeedsRehash(credentials.passwordHash)) {
      await this.usersService.updatePasswordHash(credentials.id, await hashPassword(dto.password));
    }
    const lastLoginAt = await this.usersService.recordLogin(credentials.id);

    const { passwordHash: _omit, ...profile } = credentials;
    const user = { ...profile, lastLoginAt };
    const session = await this.sessionService.create(user.id, client);
    return { user, tokens: await this.buildTokens(user.id, user.role.name as RoleName, session) };
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponseDto> {
    const rotated = await this.sessionService.rotate(refreshToken);
    return this.buildTokens(rotated.user.id, rotated.user.role.name as RoleName, rotated);
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.sessionService.revoke(user.sessionId, user.id, SessionRevokeReason.LOGOUT);
  }

  async logoutAll(user: AuthenticatedUser): Promise<void> {
    const count = await this.sessionService.revokeAll(user.id, SessionRevokeReason.LOGOUT_ALL);
    this.logger.log({ userId: user.id, count }, 'All sessions revoked');
  }

  private emailTaken(): AppException {
    return AppException.conflict(
      ErrorCode.EMAIL_ALREADY_REGISTERED,
      'An account with this email already exists',
    );
  }

  private async buildTokens(
    userId: string,
    role: RoleName,
    session: IssuedSession,
  ): Promise<AuthTokensResponseDto> {
    const access = await this.tokenService.issueAccessToken({
      sub: userId,
      sid: session.sessionId,
      role,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      tokenType: 'Bearer',
    };
  }
}
