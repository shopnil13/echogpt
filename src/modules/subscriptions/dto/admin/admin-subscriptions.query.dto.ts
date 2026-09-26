import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { TrimLowercase } from '../../../../common/transforms/string.transforms';
import { SubscriptionStatus } from '../../../../generated/prisma/enums';

export class AdminSubscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'premium' })
  @IsOptional()
  @TrimLowercase()
  @IsString()
  @Length(1, 32)
  planCode?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
