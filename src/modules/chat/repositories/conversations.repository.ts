import { Injectable } from '@nestjs/common';

import { type Conversation, type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface ConversationListQuery {
  userId: string;
  skip: number;
  take: number;
  search?: string;
}

/** Every query is scoped by `userId`: another user's conversation is indistinguishable from a missing one. */
@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    title: string;
    providerId: string | null;
    model: string | null;
  }): Promise<Conversation> {
    return this.prisma.conversation.create({ data });
  }

  findOwned(id: string, userId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({ where: { id, userId } });
  }

  async list(query: ConversationListQuery): Promise<[Conversation[], number]> {
    const where: Prisma.ConversationWhereInput = {
      userId: query.userId,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.conversation.count({ where }),
    ]);
  }

  /** Returns null when the conversation does not exist or is not owned by the user. */
  async updateOwned(
    id: string,
    userId: string,
    data: Prisma.ConversationUncheckedUpdateManyInput,
  ): Promise<Conversation | null> {
    const result = await this.prisma.conversation.updateMany({ where: { id, userId }, data });
    return result.count === 1 ? this.findOwned(id, userId) : null;
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.conversation.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }
}
