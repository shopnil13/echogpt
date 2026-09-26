import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';

export const MAX_SEARCH_RESULTS = 10;
export const DEFAULT_SEARCH_RESULTS = 5;

export class SearchDto {
  @ApiProperty({ example: 'best coffee in Lisbon', maxLength: 500 })
  @Trim()
  @IsString()
  @Length(1, 500)
  query: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Ask the default AI provider to summarize the results',
  })
  @IsOptional()
  @IsBoolean()
  summarize?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_SEARCH_RESULTS, default: DEFAULT_SEARCH_RESULTS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_RESULTS)
  maxResults?: number;
}
