import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { CurrentUser, RequireVerifiedEmail } from '../../../common/decorators/auth.decorators';
import { ConsumesQuota, Quota } from '../../../common/decorators/quota.decorators';
import { type Paginated, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { type QuotaReservation } from '../../../common/types/quota-reservation';
import { chatConfig, type ChatConfig } from '../../../config/chat.config';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations.query.dto';
import { ConversationResponseDto } from '../dto/responses/conversation.response.dto';
import { MessageResponseDto } from '../dto/responses/message.response.dto';
import { SendMessageResponseDto } from '../dto/responses/send-message.response.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { UpdateConversationDto } from '../dto/update-conversation.dto';
import { toConversationResponse, toMessageResponse } from '../mappers/chat.mapper';
import { ChatService } from '../services/chat.service';
import { ConversationsService } from '../services/conversations.service';
import { abortOnClientDisconnect, SseWriter } from '../utils/sse-writer';

const CONVERSATION_NOT_FOUND = {
  status: HttpStatus.NOT_FOUND,
  code: ErrorCode.CONVERSATION_NOT_FOUND,
  message: 'Conversation not found',
};
const PROVIDER_SELECTION_ERROR = {
  status: HttpStatus.UNPROCESSABLE_ENTITY,
  code: ErrorCode.PROVIDER_MODEL_NOT_ALLOWED,
  message: 'Model "gpt-x" is not available for OpenAI',
  description: 'PROVIDER_DISABLED or PROVIDER_MODEL_NOT_ALLOWED',
};
const SEND_ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  {
    status: HttpStatus.FORBIDDEN,
    code: ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
    message: 'Verify your email address to use this feature',
  },
  CONVERSATION_NOT_FOUND,
  PROVIDER_SELECTION_ERROR,
  {
    status: HttpStatus.TOO_MANY_REQUESTS,
    code: ErrorCode.QUOTA_EXCEEDED,
    message: 'You have used all 20 requests of your Free plan for this period',
    description: 'QUOTA_EXCEEDED (with Retry-After) or RATE_LIMITED',
  },
] as const;

@ApiTags('Chat')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Controller('chat/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly chatService: ChatService,
    @Inject(chatConfig.KEY) private readonly config: ChatConfig,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Start a conversation',
    description: 'Optionally pins a provider and model; otherwise the default provider is used.',
  })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, PROVIDER_SELECTION_ERROR)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    return toConversationResponse(await this.conversationsService.create(user.id, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List your conversations', description: 'Most recently updated first.' })
  @ApiPaginatedResponse(ConversationResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<Paginated<ConversationResponseDto>> {
    const page = await this.conversationsService.list(user.id, query);
    return { data: page.data.map(toConversationResponse), meta: page.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation' })
  @ApiOkResponse({ type: ConversationResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, CONVERSATION_NOT_FOUND)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConversationResponseDto> {
    return toConversationResponse(await this.conversationsService.getOwned(id, user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a conversation or change its preferred provider/model' })
  @ApiOkResponse({ type: ConversationResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    CONVERSATION_NOT_FOUND,
    PROVIDER_SELECTION_ERROR,
  )
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    return toConversationResponse(await this.conversationsService.update(id, user.id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation and all of its messages' })
  @ApiNoContentResponse({ description: 'Conversation deleted' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, CONVERSATION_NOT_FOUND)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.conversationsService.remove(id, user.id);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Get conversation history',
    description:
      'Oldest first. FAILED assistant messages are included for transparency but never sent as context.',
  })
  @ApiPaginatedResponse(MessageResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, CONVERSATION_NOT_FOUND)
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<MessageResponseDto>> {
    const page = await this.conversationsService.listMessages(id, user.id, query);
    return { data: page.data.map(toMessageResponse), meta: page.meta };
  }

  @Post(':id/messages')
  @ConsumesQuota()
  @RequireVerifiedEmail()
  @ApiOperation({
    summary: 'Send a prompt and receive the AI response',
    description:
      'Consumes one request from your plan. Provider selection: request > conversation preference > default. ' +
      'The last messages of the conversation are sent as context. If the provider fails, the unit is refunded.',
  })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @ApiErrorResponses(
    ...SEND_ERRORS,
    {
      status: HttpStatus.BAD_GATEWAY,
      code: ErrorCode.PROVIDER_UNAVAILABLE,
      message: 'The AI provider failed to process the request',
      description: 'PROVIDER_UNAVAILABLE or PROVIDER_AUTH_FAILED',
    },
    {
      status: HttpStatus.GATEWAY_TIMEOUT,
      code: ErrorCode.PROVIDER_TIMEOUT,
      message: 'The AI provider did not respond in time',
    },
  )
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
    @Quota() reservation: QuotaReservation,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SendMessageResponseDto> {
    const turn = await this.chatService.prepareTurn(user.id, id, dto, reservation);
    const completed = await this.chatService.runTurn(turn, abortOnClientDisconnect(response));
    return {
      userMessage: toMessageResponse(completed.userMessage),
      assistantMessage: toMessageResponse(completed.assistantMessage),
    };
  }

  @Post(':id/messages/stream')
  @ConsumesQuota()
  @RequireVerifiedEmail()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Send a prompt and stream the AI response (Server-Sent Events)',
    description: [
      'Validation errors return a normal JSON error. Once streaming starts the status is 200 and events are:',
      '',
      '- `message.start` `{ conversationId, userMessageId, providerId, model }`',
      '- `message.delta` `{ text }` (repeated)',
      '- `message.complete` `{ assistantMessageId, model, usage: { promptTokens, completionTokens }, latencyMs }`',
      '- `error` `{ code, message, requestId }` (the stream then ends; quota is refunded)',
      '',
      'Comment lines (`: ping`) are heartbeats. Disconnecting cancels the upstream request.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Event stream',
    content: {
      'text/event-stream': {
        example:
          'event: message.start\ndata: {"conversationId":"…","userMessageId":"…","providerId":"…","model":"claude-opus-5"}\n\n' +
          'event: message.delta\ndata: {"text":"Hello"}\n\n' +
          'event: message.complete\ndata: {"assistantMessageId":"…","model":"claude-opus-5","usage":{"promptTokens":12,"completionTokens":3},"latencyMs":840}\n\n',
      },
    },
  })
  @ApiErrorResponses(...SEND_ERRORS)
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
    @Quota() reservation: QuotaReservation,
    @Res() response: Response,
  ): Promise<void> {
    const turn = await this.chatService.prepareTurn(user.id, id, dto, reservation);
    const signal = abortOnClientDisconnect(response);
    const writer = new SseWriter(response, this.config.streamHeartbeatMs);
    await this.chatService.streamTurn(turn, writer, signal);
  }
}
