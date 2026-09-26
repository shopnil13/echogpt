import { ApiProperty } from '@nestjs/swagger';

import { UsageFeature } from '../../../../generated/prisma/enums';

export class RequestLogResponseDto {
  @ApiProperty({ example: '1042', description: 'Sequential id (string: 64-bit integer)' })
  id: string;

  @ApiProperty({ example: '4f0c8a2e-1b3d-4c5e-9f6a-7b8c9d0e1f2a' })
  requestId: string;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  userId: string | null;

  @ApiProperty({ example: 'POST' })
  method: string;

  @ApiProperty({ example: '/api/v1/chat/conversations/:id/messages' })
  route: string;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: 842 })
  durationMs: number;

  @ApiProperty({ nullable: true, type: String, example: '203.0.113.7' })
  ipAddress: string | null;

  @ApiProperty({ nullable: true, type: String })
  userAgent: string | null;

  @ApiProperty({ nullable: true, enum: UsageFeature })
  feature: UsageFeature | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  providerId: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'claude-opus-5' })
  model: string | null;

  @ApiProperty({ nullable: true, type: Number })
  promptTokens: number | null;

  @ApiProperty({ nullable: true, type: Number })
  completionTokens: number | null;

  @ApiProperty({ nullable: true, type: String, example: null })
  errorCode: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
