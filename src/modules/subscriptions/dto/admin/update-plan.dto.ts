import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import { Trim } from '../../../../common/transforms/string.transforms';
import { LimitPeriod } from '../../../../generated/prisma/enums';

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Premium' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 64)
  name?: string;

  @ApiPropertyOptional({ example: 'Higher daily allowance for power users' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 255)
  description?: string;

  @ApiPropertyOptional({ example: 1499, description: 'Price in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  priceCents?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Requests per period; applies immediately to all subscribers',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  requestLimit?: number;

  @ApiPropertyOptional({ enum: LimitPeriod })
  @IsOptional()
  @IsEnum(LimitPeriod)
  limitPeriod?: LimitPeriod;

  @ApiPropertyOptional({
    description: 'Inactive plans are hidden from GET /plans and cannot be chosen',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
