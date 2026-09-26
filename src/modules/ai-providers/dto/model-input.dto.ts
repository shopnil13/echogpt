import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';

export const MODEL_NAME_PATTERN = /^[A-Za-z0-9._:/-]+$/;

export class ModelInputDto {
  @ApiProperty({ example: 'claude-opus-5', description: "The provider's model identifier" })
  @Trim()
  @IsString()
  @Length(1, 128)
  @Matches(MODEL_NAME_PATTERN, { message: 'name may contain letters, digits and . _ : / -' })
  name: string;

  @ApiPropertyOptional({ example: 'Claude Opus 5', description: 'Defaults to the model name' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 128)
  displayName?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
