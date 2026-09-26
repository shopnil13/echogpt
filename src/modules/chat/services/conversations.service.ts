import { Injectable } from '@nestjs/common';

import { type Paginated, paginate } from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type Conversation, type Message } from '../../../generated/prisma/client';
import { AiProviderResolver } from '../../ai-providers/services/ai-provider-resolver.service';
import { type CreateConversationDto } from '../dto/create-conversation.dto';
import { type ListConversationsQueryDto } from '../dto/list-conversations.query.dto';
import { type UpdateConversationDto } from '../dto/update-conversation.dto';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesRepository } from '../repositories/messages.repository';
import { DEFAULT_CONVERSATION_TITLE } from '../utils/chat-context';
import { type PaginationQueryDto } from '../../../common/dto/pagination.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly providerResolver: AiProviderResolver,
  ) {}

  async create(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const preference = await this.validatePreference(dto.providerId, dto.model);
    return this.conversationsRepository.create({
      userId,
      title: dto.title ?? DEFAULT_CONVERSATION_TITLE,
      ...preference,
    });
  }

  async list(userId: string, query: ListConversationsQueryDto): Promise<Paginated<Conversation>> {
    const [items, total] = await this.conversationsRepository.list({
      userId,
      skip: query.skip,
      take: query.limit,
      search: query.search,
    });
    return paginate(items, total, query);
  }

  async getOwned(id: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOwned(id, userId);
    if (!conversation) throw this.notFound();
    return conversation;
  }

  async update(id: string, userId: string, dto: UpdateConversationDto): Promise<Conversation> {
    const current = await this.getOwned(id, userId);
    const providerChanged = dto.providerId !== undefined || dto.model !== undefined;
    const preference = providerChanged
      ? await this.validatePreference(
          dto.providerId === undefined ? current.providerId : dto.providerId,
          dto.model === undefined ? current.model : dto.model,
        )
      : {};

    const updated = await this.conversationsRepository.updateOwned(id, userId, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...preference,
    });
    if (!updated) throw this.notFound();
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!(await this.conversationsRepository.deleteOwned(id, userId))) throw this.notFound();
  }

  async listMessages(
    id: string,
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<Message>> {
    await this.getOwned(id, userId);
    const [items, total] = await this.messagesRepository.list(id, query.skip, query.limit);
    return paginate(items, total, query);
  }

  /** Stores a preference only if it is currently selectable (fails early instead of at send time). */
  private async validatePreference(
    providerId: string | null | undefined,
    model: string | null | undefined,
  ): Promise<{ providerId: string | null; model: string | null }> {
    if (!providerId && !model) return { providerId: null, model: null };
    const resolved = await this.providerResolver.resolve({ providerId, model });
    // A model is only meaningful for a specific provider, so pin the provider that validated it.
    return { providerId: resolved.providerId, model: model ? resolved.model : null };
  }

  private notFound(): AppException {
    return AppException.notFound(ErrorCode.CONVERSATION_NOT_FOUND, 'Conversation not found');
  }
}
