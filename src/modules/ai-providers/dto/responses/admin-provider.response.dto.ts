import { ApiProperty } from '@nestjs/swagger';

import { ProviderHealthStatus, ProviderType } from '../../../../generated/prisma/enums';

export class ProviderModelResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'claude-opus-5' })
  name: string;

  @ApiProperty({ example: 'Claude Opus 5' })
  displayName: string;

  @ApiProperty({ example: true })
  isEnabled: boolean;
}

export class ProviderHealthResponseDto {
  @ApiProperty({ enum: ProviderHealthStatus, example: ProviderHealthStatus.HEALTHY })
  status: ProviderHealthStatus;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  checkedAt: Date | null;

  @ApiProperty({ nullable: true, type: Number, example: 182 })
  latencyMs: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description: 'Sanitized upstream error',
  })
  error: string | null;
}

export class AdminProviderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Anthropic Claude' })
  name: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.ANTHROPIC })
  type: ProviderType;

  @ApiProperty({ nullable: true, type: String, example: null })
  baseUrl: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether an API key is stored (the key itself is never returned)',
  })
  hasApiKey: boolean;

  @ApiProperty({ nullable: true, type: String, example: 'x9Qa' })
  apiKeyLast4: string | null;

  @ApiProperty({ example: 'claude-opus-5' })
  defaultModel: string;

  @ApiProperty({ example: true })
  isEnabled: boolean;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiProperty({ nullable: true, type: Number, example: null })
  timeoutMs: number | null;

  @ApiProperty({ type: ProviderHealthResponseDto })
  health: ProviderHealthResponseDto;

  @ApiProperty({ type: ProviderModelResponseDto, isArray: true })
  models: ProviderModelResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}
