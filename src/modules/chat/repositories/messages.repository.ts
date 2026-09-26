import { Injectable } from '@nestjs/common';

import { type Message, type Prisma } from '../../../generated/prisma/client';
import { MessageStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MessageUncheckedCreateInput): Promise<Message> {
    return this.prisma.message.create({ data });
  }

  /** The most recent successful messages, returned oldest first for use as model context. */
  async recentCompleted(conversationId: string, limit: number): Promise<Message[]> {
    if (limit === 0) return [];
    const newestFirst = await this.prisma.message.findMany({
      where: { conversationId, status: MessageStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return newestFirst.reverse();
  }

  async list(conversationId: string, skip: number, take: number): Promise<[Message[], number]> {
    return this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);
  }
}
