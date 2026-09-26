import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';
import { MODEL_NAME_PATTERN } from '../../ai-providers/dto/model-input.dto';

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Trip planning', description: 'Defaults to the first prompt' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Preferred provider (see GET /providers); default provider if omitted',
  })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({
    example: 'claude-opus-5',
    description: "Preferred model; the provider's default if omitted",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(MODEL_NAME_PATTERN)
  model?: string;
}
