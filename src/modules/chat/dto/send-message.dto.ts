import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import { MODEL_NAME_PATTERN } from '../../ai-providers/dto/model-input.dto';

export const MAX_PROMPT_CHARS = 16_000;

export class SendMessageDto {
  @ApiProperty({
    example: 'Summarize the plot of Hamlet in three sentences.',
    maxLength: MAX_PROMPT_CHARS,
  })
  @IsString()
  @Length(1, MAX_PROMPT_CHARS)
  content: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Provider for this message; also becomes the conversation preference',
  })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ example: 'claude-opus-5' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(MODEL_NAME_PATTERN)
  model?: string;
}
