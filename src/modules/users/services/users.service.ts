import { Injectable } from '@nestjs/common';

import { DEFAULT_PLAN_CODE } from '../../../common/constants/plans.constants';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type DbClient } from '../../../infrastructure/prisma/prisma.types';
import {
  type CreateUserData,
  type UserCredentialsRecord,
  type UserProfileRecord,
  UsersRepository,
} from '../repositories/users.repository';

/** Public API of the users module. Other modules use this service, never the repository. */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string): Promise<UserProfileRecord> {
    const user = await this.usersRepository.findProfileById(userId);
    if (!user) throw AppException.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    return user;
  }

  /** Includes the password hash; for credential checks only. */
  findCredentialsByEmail(email: string): Promise<UserCredentialsRecord | null> {
    return this.usersRepository.findCredentialsByEmail(email);
  }

  /** Includes the password hash; for credential checks only. */
  findCredentialsById(userId: string): Promise<UserCredentialsRecord | null> {
    return this.usersRepository.findCredentialsById(userId);
  }

  emailExists(email: string): Promise<boolean> {
    return this.usersRepository.existsByEmail(email);
  }

  /** Creates a USER account on the default plan. */
  createAccount(data: CreateUserData, db?: DbClient): Promise<UserProfileRecord> {
    return this.usersRepository.createWithPlan(data, DEFAULT_PLAN_CODE, db);
  }

  updatePasswordHash(userId: string, passwordHash: string, db?: DbClient): Promise<void> {
    return this.usersRepository.updatePasswordHash(userId, passwordHash, db);
  }

  /** Stores and returns the login timestamp. */
  async recordLogin(userId: string): Promise<Date> {
    const at = new Date();
    await this.usersRepository.touchLastLogin(userId, at);
    return at;
  }

  markEmailVerified(userId: string, db?: DbClient): Promise<void> {
    return this.usersRepository.markEmailVerified(userId, db);
  }
}
