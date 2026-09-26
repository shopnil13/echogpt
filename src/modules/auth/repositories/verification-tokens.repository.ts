import { Injectable } from '@nestjs/common';

import { type VerificationPurpose } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type DbClient } from '../../../infrastructure/prisma/prisma.types';

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

@Injectable()
export class VerificationTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    purpose: VerificationPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.verificationToken.create({ data });
  }

  findByHash(
    tokenHash: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationTokenRecord | null> {
    return this.prisma.verificationToken.findFirst({
      where: { tokenHash, purpose },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
  }

  /** Marks the token used only if still unused; returns false when another request won the race. */
  async consume(id: string, db: DbClient = this.prisma): Promise<boolean> {
    const result = await db.verificationToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  }

  /** Invalidates outstanding tokens so only the most recently sent link works. */
  async invalidateOutstanding(userId: string, purpose: VerificationPurpose): Promise<void> {
    await this.prisma.verificationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
