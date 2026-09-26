import { Injectable } from '@nestjs/common';

import { type Prisma, type SessionRevokeReason } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type DbClient } from '../../../infrastructure/prisma/prisma.types';

const sessionWithUserSelect = {
  id: true,
  userId: true,
  refreshTokenHash: true,
  expiresAt: true,
  revokedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      status: true,
      emailVerifiedAt: true,
      role: { select: { name: true } },
    },
  },
} satisfies Prisma.SessionSelect;

export type SessionWithUser = Prisma.SessionGetPayload<{ select: typeof sessionWithUserSelect }>;

const sessionSummarySelect = {
  id: true,
  userAgent: true,
  ipAddress: true,
  createdAt: true,
  lastUsedAt: true,
  expiresAt: true,
} satisfies Prisma.SessionSelect;

export type SessionSummary = Prisma.SessionGetPayload<{ select: typeof sessionSummarySelect }>;

export interface CreateSessionData {
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSessionData): Promise<string> {
    const session = await this.prisma.session.create({ data, select: { id: true } });
    return session.id;
  }

  findWithUser(id: string): Promise<SessionWithUser | null> {
    return this.prisma.session.findUnique({ where: { id }, select: sessionWithUserSelect });
  }

  listActiveForUser(userId: string, now: Date): Promise<SessionSummary[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      select: sessionSummarySelect,
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Replaces the refresh hash only if it still equals `currentHash` (optimistic concurrency),
   * so two concurrent refreshes with the same token cannot both succeed.
   */
  async rotate(id: string, currentHash: string, nextHash: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id, refreshTokenHash: currentHash, revokedAt: null },
      data: { refreshTokenHash: nextHash, lastUsedAt: new Date() },
    });
    return result.count === 1;
  }

  async revoke(id: string, reason: SessionRevokeReason, userId?: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id, revokedAt: null, ...(userId ? { userId } : {}) },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count === 1;
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason,
    exceptSessionId?: string,
    db: DbClient = this.prisma,
  ): Promise<number> {
    const result = await db.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async deleteExpired(before: Date): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }] },
    });
    return result.count;
  }
}
