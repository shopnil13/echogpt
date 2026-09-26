import { Inject, Injectable, Logger } from '@nestjs/common';

import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type QuotaReservation } from '../../../common/types/quota-reservation';
import { chatConfig, type ChatConfig } from '../../../config/chat.config';
import { type Conversation, type Message } from '../../../generated/prisma/client';
import { MessageRole, MessageStatus, UsageFeature } from '../../../generated/prisma/enums';
import { AiProviderError } from '../../ai-providers/adapters/ai-provider.error';
import {
  type ChatInput,
  type ChatResult,
} from '../../ai-providers/interfaces/ai-provider-adapter.interface';
import {
  AiProviderResolver,
  type ResolvedProvider,
} from '../../ai-providers/services/ai-provider-resolver.service';
import { QuotaService } from '../../subscriptions/services/quota.service';
import { type SendMessageDto } from '../dto/send-message.dto';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { MessagesRepository } from '../repositories/messages.repository';
import { DEFAULT_CONVERSATION_TITLE, titleFromPrompt, toChatTurns } from '../utils/chat-context';
import { type SseWriter } from '../utils/sse-writer';
import { ConversationsService } from './conversations.service';

/** Everything needed to run one prompt/response turn once validation has passed. */
export interface PreparedTurn {
  conversation: Conversation;
  userMessage: Message;
  provider: ResolvedProvider;
  input: ChatInput;
  reservation: QuotaReservation;
}

export interface CompletedTurn {
  userMessage: Message;
  assistantMessage: Message;
}

const CLIENT_ABORTED = 'CLIENT_ABORTED';

/**
 * Runs chat turns: resolves the provider, builds context, calls the adapter, persists both
 * messages and records usage. Any failure after the quota was consumed refunds it.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly providerResolver: AiProviderResolver,
    private readonly quotaService: QuotaService,
    @Inject(chatConfig.KEY) private readonly config: ChatConfig,
  ) {}

  /**
   * Validates the request and stores the user message. Runs before any streaming header is
   * sent, so validation errors still return regular JSON responses.
   */
  async prepareTurn(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
    reservation: QuotaReservation,
  ): Promise<PreparedTurn> {
    try {
      const conversation = await this.conversationsService.getOwned(conversationId, userId);
      const provider = await this.providerResolver.resolve({
        providerId: dto.providerId,
        model: dto.model,
        preferredProviderId: conversation.providerId,
        preferredModel: conversation.model,
      });
      const history = await this.messagesRepository.recentCompleted(
        conversation.id,
        this.config.contextMessages,
      );
      const userMessage = await this.messagesRepository.create({
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: dto.content,
      });

      RequestContext.recordUsage({
        feature: UsageFeature.CHAT,
        providerId: provider.providerId,
        model: provider.model,
      });
      return {
        conversation,
        userMessage,
        provider,
        reservation,
        input: {
          model: provider.model,
          system: this.config.systemPrompt,
          messages: toChatTurns([...history, userMessage]),
          maxOutputTokens: provider.maxOutputTokens,
        },
      };
    } catch (error: unknown) {
      await this.quotaService.refund(reservation);
      throw error;
    }
  }

  async runTurn(turn: PreparedTurn, signal: AbortSignal): Promise<CompletedTurn> {
    const startedAt = Date.now();
    try {
      const result = await turn.provider.adapter.chat(turn.input, turn.provider.config, signal);
      return await this.completeTurn(turn, result, Date.now() - startedAt);
    } catch (error: unknown) {
      await this.failTurn(turn, error, '', Date.now() - startedAt);
      throw error;
    }
  }

  /** Streams the assistant reply as SSE events and persists it when the stream ends. */
  async streamTurn(turn: PreparedTurn, writer: SseWriter, signal: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    let partial = '';
    writer.send('message.start', {
      conversationId: turn.conversation.id,
      userMessageId: turn.userMessage.id,
      providerId: turn.provider.providerId,
      model: turn.provider.model,
    });

    try {
      for await (const event of turn.provider.adapter.chatStream(
        turn.input,
        turn.provider.config,
        signal,
      )) {
        if (event.type === 'delta') {
          partial += event.text;
          writer.send('message.delta', { text: event.text });
        } else {
          const completed = await this.completeTurn(turn, event.result, Date.now() - startedAt);
          writer.send('message.complete', {
            assistantMessageId: completed.assistantMessage.id,
            model: completed.assistantMessage.model,
            usage: {
              promptTokens: completed.assistantMessage.promptTokens,
              completionTokens: completed.assistantMessage.completionTokens,
            },
            latencyMs: completed.assistantMessage.latencyMs,
          });
        }
      }
    } catch (error: unknown) {
      await this.failTurn(turn, error, partial, Date.now() - startedAt);
      const code = errorCodeOf(error);
      RequestContext.setErrorCode(code);
      writer.send('error', {
        code,
        message: error instanceof AppException ? error.message : 'An unexpected error occurred',
        requestId: RequestContext.current()?.requestId ?? null,
      });
    } finally {
      writer.close();
    }
  }

  private async completeTurn(
    turn: PreparedTurn,
    result: ChatResult,
    latencyMs: number,
  ): Promise<CompletedTurn> {
    const assistantMessage = await this.messagesRepository.create({
      conversationId: turn.conversation.id,
      role: MessageRole.ASSISTANT,
      content: result.text,
      providerId: turn.provider.providerId,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      latencyMs,
    });

    await this.conversationsRepository.updateOwned(turn.conversation.id, turn.conversation.userId, {
      lastMessageAt: assistantMessage.createdAt,
      providerId: turn.provider.providerId,
      model: turn.provider.model,
      ...(turn.conversation.title === DEFAULT_CONVERSATION_TITLE
        ? { title: titleFromPrompt(turn.userMessage.content) }
        : {}),
    });

    RequestContext.recordUsage({
      model: result.model,
      promptTokens: result.usage.promptTokens ?? undefined,
      completionTokens: result.usage.completionTokens ?? undefined,
    });
    return { userMessage: turn.userMessage, assistantMessage };
  }

  /** Keeps a FAILED assistant message for debugging and gives the quota unit back. */
  private async failTurn(
    turn: PreparedTurn,
    error: unknown,
    partial: string,
    latencyMs: number,
  ): Promise<void> {
    await this.quotaService.refund(turn.reservation);
    const errorCode = errorCodeOf(error);
    try {
      await this.messagesRepository.create({
        conversationId: turn.conversation.id,
        role: MessageRole.ASSISTANT,
        content: partial,
        status: MessageStatus.FAILED,
        providerId: turn.provider.providerId,
        model: turn.provider.model,
        latencyMs,
        errorCode,
      });
    } catch (persistError: unknown) {
      this.logger.error(
        { err: persistError, conversationId: turn.conversation.id },
        'Failed to record failed turn',
      );
    }

    const detail = error instanceof AiProviderError ? error.detail : undefined;
    this.logger.warn(
      {
        conversationId: turn.conversation.id,
        providerId: turn.provider.providerId,
        errorCode,
        detail,
      },
      'Chat turn failed',
    );
  }
}

function errorCodeOf(error: unknown): string {
  if (error instanceof AiProviderError && error.failure === 'ABORTED') return CLIENT_ABORTED;
  return error instanceof AppException ? error.code : ErrorCode.INTERNAL_ERROR;
}
