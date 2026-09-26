import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Trim } from '../../../common/transforms/string.transforms';

export class ListConversationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'trip', description: 'Case-insensitive title filter' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;
}
