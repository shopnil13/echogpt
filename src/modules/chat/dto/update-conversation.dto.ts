import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches, ValidateIf } from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';
import { MODEL_NAME_PATTERN } from '../../ai-providers/dto/model-input.dto';

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: 'Renamed conversation' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'null resets to the default provider',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateConversationDto) => dto.providerId !== null)
  @IsUUID()
  providerId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'claude-sonnet-5' })
  @IsOptional()
  @ValidateIf((dto: UpdateConversationDto) => dto.model !== null)
  @IsString()
  @Length(1, 128)
  @Matches(MODEL_NAME_PATTERN)
  model?: string | null;
}
