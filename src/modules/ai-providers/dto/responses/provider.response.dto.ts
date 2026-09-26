import { ApiProperty } from '@nestjs/swagger';

import { ProviderType } from '../../../../generated/prisma/enums';

export class PublicModelResponseDto {
  @ApiProperty({ example: 'claude-opus-5' })
  name: string;

  @ApiProperty({ example: 'Claude Opus 5' })
  displayName: string;
}

/** What end users see: enough to pick a provider and model, nothing operational. */
export class ProviderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Anthropic Claude' })
  name: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.ANTHROPIC })
  type: ProviderType;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty({ example: 'claude-opus-5' })
  defaultModel: string;

  @ApiProperty({ type: PublicModelResponseDto, isArray: true })
  models: PublicModelResponseDto[];
}
