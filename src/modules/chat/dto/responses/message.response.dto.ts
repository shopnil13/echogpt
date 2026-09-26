import { ApiProperty } from '@nestjs/swagger';

import { MessageRole, MessageStatus } from '../../../../generated/prisma/enums';

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ enum: MessageRole, example: MessageRole.ASSISTANT })
  role: MessageRole;

  @ApiProperty({ example: 'Prince Hamlet seeks revenge…' })
  content: string;

  @ApiProperty({ enum: MessageStatus, example: MessageStatus.COMPLETED })
  status: MessageStatus;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  providerId: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'claude-opus-5' })
  model: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 412 })
  promptTokens: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 96 })
  completionTokens: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 1830 })
  latencyMs: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description: 'Set on FAILED assistant messages',
  })
  errorCode: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
