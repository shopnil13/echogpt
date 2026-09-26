import { Injectable } from '@nestjs/common';

import { type PlanCode } from '../../../common/constants/plans.constants';
import { RoleName } from '../../../common/constants/roles.constants';
import { type Prisma, type UserStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type DbClient } from '../../../infrastructure/prisma/prisma.types';

export const userProfileSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
} satisfies Prisma.UserSelect;

export type UserProfileRecord = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;

const userCredentialsSelect = {
  ...userProfileSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

/** Includes the password hash: never map this to a response. */
export type UserCredentialsRecord = Prisma.UserGetPayload<{ select: typeof userCredentialsSelect }>;

export interface AdminUserListQuery {
  skip: number;
  take: number;
  search?: string;
  role?: RoleName;
  status?: UserStatus;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfileById(id: string, db: DbClient = this.prisma): Promise<UserProfileRecord | null> {
    return db.user.findUnique({ where: { id }, select: userProfileSelect });
  }

  findCredentialsByEmail(email: string): Promise<UserCredentialsRecord | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userCredentialsSelect });
  }

  findCredentialsById(id: string): Promise<UserCredentialsRecord | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userCredentialsSelect });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  /** Creates a USER account together with its initial subscription in one statement. */
  createWithPlan(
    data: CreateUserData,
    planCode: PlanCode,
    db: DbClient = this.prisma,
  ): Promise<UserProfileRecord> {
    return db.user.create({
      data: {
        ...data,
        role: { connect: { name: RoleName.USER } },
        subscriptions: { create: { plan: { connect: { code: planCode } } } },
      },
      select: userProfileSelect,
    });
  }

  async updatePasswordHash(
    id: string,
    passwordHash: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.user.update({ where: { id }, data: { passwordHash } });
  }

  async touchLastLogin(id: string, at: Date): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: at } });
  }

  async markEmailVerified(id: string, db: DbClient = this.prisma): Promise<void> {
    await db.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  }

  updateProfile(
    id: string,
    data: { fullName?: string; avatarUrl?: string | null },
  ): Promise<UserProfileRecord> {
    return this.prisma.user.update({ where: { id }, data, select: userProfileSelect });
  }

  /** Hard delete; owned rows cascade and usage logs are anonymized by the FK (ADR-013). */
  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async listForAdmin(query: AdminUserListQuery): Promise<[UserProfileRecord[], number]> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: { name: query.role } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userProfileSelect,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  updateRole(id: string, role: RoleName, db: DbClient = this.prisma): Promise<UserProfileRecord> {
    return db.user.update({
      where: { id },
      data: { role: { connect: { name: role } } },
      select: userProfileSelect,
    });
  }

  countByRole(role: RoleName): Promise<number> {
    return this.prisma.user.count({ where: { role: { name: role } } });
  }

  async updateStatus(id: string, status: UserStatus, db: DbClient = this.prisma): Promise<void> {
    await db.user.update({ where: { id }, data: { status } });
  }
}
