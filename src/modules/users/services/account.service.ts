import { Injectable, Logger } from '@nestjs/common';

import { RoleName } from '../../../common/constants/roles.constants';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { SessionRevokeReason } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../../infrastructure/security/password-hashing';
import { SessionService } from '../../sessions/services/session.service';
import { type ChangePasswordDto } from '../dto/change-password.dto';
import { type UpdateProfileDto } from '../dto/update-profile.dto';
import {
  type UserCredentialsRecord,
  type UserProfileRecord,
  UsersRepository,
} from '../repositories/users.repository';

/** Self-service operations a signed-in user performs on their own account. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionService: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileRecord> {
    const user = await this.usersRepository.findProfileById(userId);
    if (!user) throw AppException.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    return user;
  }

  updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileRecord> {
    return this.usersRepository.updateProfile(userId, {
      fullName: dto.fullName,
      avatarUrl: dto.avatarUrl,
    });
  }

  /** Changes the password and signs out every other device in the same transaction. */
  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto): Promise<void> {
    const credentials = await this.requireCredentials(user.id);
    await this.assertPassword(credentials, dto.currentPassword);
    if (await verifyPassword(credentials.passwordHash, dto.newPassword)) {
      throw AppException.unprocessable(
        ErrorCode.PASSWORD_UNCHANGED,
        'New password must differ from the current one',
      );
    }

    const passwordHash = await hashPassword(dto.newPassword);
    const revoked = await this.prisma.$transaction(async (tx) => {
      await this.usersRepository.updatePasswordHash(user.id, passwordHash, tx);
      return this.sessionService.revokeAll(
        user.id,
        SessionRevokeReason.PASSWORD_CHANGED,
        user.sessionId,
        tx,
      );
    });
    this.logger.log({ userId: user.id, revokedSessions: revoked }, 'Password changed');
  }

  /** Permanently deletes the account and its personal data after re-authentication. */
  async deleteAccount(user: AuthenticatedUser, password: string): Promise<void> {
    const credentials = await this.requireCredentials(user.id);
    await this.assertPassword(credentials, password);
    if (
      user.role === RoleName.ADMIN &&
      (await this.usersRepository.countByRole(RoleName.ADMIN)) <= 1
    ) {
      throw AppException.unprocessable(
        ErrorCode.LAST_ADMIN,
        'The last administrator account cannot be deleted',
      );
    }

    await this.usersRepository.delete(user.id);
    this.logger.log({ userId: user.id }, 'Account deleted');
  }

  private async requireCredentials(userId: string): Promise<UserCredentialsRecord> {
    const credentials = await this.usersRepository.findCredentialsById(userId);
    if (!credentials) throw AppException.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    return credentials;
  }

  private async assertPassword(
    credentials: UserCredentialsRecord,
    password: string,
  ): Promise<void> {
    if (!(await verifyPassword(credentials.passwordHash, password))) {
      throw AppException.unprocessable(ErrorCode.PASSWORD_INCORRECT, 'Password is incorrect');
    }
  }
}
