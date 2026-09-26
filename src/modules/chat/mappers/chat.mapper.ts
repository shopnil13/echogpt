import { type Conversation, type Message } from '../../../generated/prisma/client';
import { type ConversationResponseDto } from '../dto/responses/conversation.response.dto';
import { type MessageResponseDto } from '../dto/responses/message.response.dto';

export function toConversationResponse(conversation: Conversation): ConversationResponseDto {
  return {
    id: conversation.id,
    title: conversation.title,
    providerId: conversation.providerId,
    model: conversation.model,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function toMessageResponse(message: Message): MessageResponseDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    status: message.status,
    providerId: message.providerId,
    model: message.model,
    promptTokens: message.promptTokens,
    completionTokens: message.completionTokens,
    latencyMs: message.latencyMs,
    errorCode: message.errorCode,
    createdAt: message.createdAt,
  };
}
