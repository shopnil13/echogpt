import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';
import { ProviderType } from '../../../generated/prisma/enums';
import { MODEL_NAME_PATTERN, ModelInputDto } from './model-input.dto';

export const MAX_MODELS_PER_PROVIDER = 50;

export class CreateProviderDto {
  @ApiProperty({ example: 'Anthropic Claude', description: 'Unique display name' })
  @Trim()
  @IsString()
  @Length(1, 64)
  name: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.ANTHROPIC })
  @IsEnum(ProviderType)
  type: ProviderType;

  @ApiPropertyOptional({
    example: 'sk-ant-api03-…',
    description:
      'Write-only. Stored encrypted (AES-256-GCM); responses only show the last 4 characters.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @Length(8, 512)
  apiKey?: string;

  @ApiPropertyOptional({
    example: 'https://api.example-gateway.com/v1',
    description:
      'Optional HTTPS endpoint override (e.g. an enterprise gateway). Internal addresses are rejected.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;

  @ApiProperty({ example: 'claude-opus-5', description: 'Must be one of `models`' })
  @Trim()
  @IsString()
  @Length(1, 128)
  @Matches(MODEL_NAME_PATTERN)
  defaultModel: string;

  @ApiProperty({ type: ModelInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MODELS_PER_PROVIDER)
  @ValidateNested({ each: true })
  @Type(() => ModelInputDto)
  models: ModelInputDto[];

  @ApiPropertyOptional({
    example: 60000,
    description: 'Per-request timeout override in milliseconds',
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(600_000)
  timeoutMs?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Enable immediately (requires an API key for real providers)',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
