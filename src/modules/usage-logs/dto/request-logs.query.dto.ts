import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Trim } from '../../../common/transforms/string.transforms';
import { UsageFeature } from '../../../generated/prisma/enums';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export class RequestLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @ApiPropertyOptional({ enum: HTTP_METHODS })
  @IsOptional()
  @IsIn(HTTP_METHODS)
  method?: (typeof HTTP_METHODS)[number];

  @ApiPropertyOptional({ example: '/api/v1/chat', description: 'Route pattern contains this text' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  route?: string;

  @ApiPropertyOptional({ enum: UsageFeature })
  @IsOptional()
  @IsEnum(UsageFeature)
  feature?: UsageFeature;

  @ApiPropertyOptional({ example: '2026-09-20T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-09-27T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
